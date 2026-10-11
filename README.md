# Mini Task Manager

Aplikasi sederhana untuk tim internal: membuat task, mengubah status ke status mana pun (termasuk kembali atau melompat), dan melihat **audit log per task** yang tidak bisa diubah atau dihapus.

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Node.js + Express 5 + TypeScript
- **Persistence**: file JSON (`backend/data/db.json`) dengan penulisan atomik

```
task1/
├── backend/   # Express API (domain, persistence, services, http)
└── frontend/  # React UI (api client, components)
```

---

## Cara menjalankan

Prasyarat: Node.js 20+ (diuji dengan Node 22) dan npm.

```bash
# 1. Backend (port 3001)
cd backend
npm install
npm run dev          # development (tsx watch)
# atau: npm run build && npm start

# 2. Frontend (port 5173), di terminal lain
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173. Vite meneruskan semua request `/api/*` ke backend, sehingga browser tidak pernah memanggil `localhost` secara langsung.

Perintah lain:

| Lokasi     | Perintah            | Keterangan                                |
|------------|---------------------|-------------------------------------------|
| backend    | `npm test`          | 14 test: domain, service, API, persistence |
| backend    | `npm run typecheck` | Type check tanpa build                    |
| frontend   | `npm run build`     | Type check + build production             |

Variabel environment (opsional):

- `PORT` (default `3001`)
- `DATA_FILE` (default `backend/data/db.json`)
- `API_PROXY_TARGET` untuk frontend (default `http://127.0.0.1:3001`)

Untuk mereset data, hentikan backend lalu hapus `backend/data/db.json`.

---

## Arsitektur

### Backend

```
src/
├── domain/        # Aturan murni: status & transisi, daftar actor, tipe data
├── services/      # TaskService: validasi, alur status, pembuatan audit log
├── persistence/   # Database (JSON + serialisasi write), auditChain (hash chain)
├── http/          # Express app: routing, mapping error ke HTTP
├── errors.ts      # AppError dengan kode yang konsisten
└── server.ts      # Entry point: load data, cek integritas, listen
```

Alurnya satu arah: **route → service → database**. Route hanya memetakan HTTP ke service; seluruh aturan bisnis ada di service dan domain sehingga bisa diuji tanpa HTTP.

### API

| Method | Path                          | Keterangan                                              |
|--------|-------------------------------|---------------------------------------------------------|
| GET    | `/api/meta`                   | Daftar actor dan status                                 |
| GET    | `/api/tasks`                  | Semua task                                              |
| POST   | `/api/tasks`                  | Buat task `{ title, description?, actor }` → 201        |
| PUT    | `/api/tasks/:id/status`       | Ubah status `{ status, actor }` → 200 (`changed` bool)  |
| DELETE | `/api/tasks/:id`              | Hapus task `{ actor }` → 204                            |
| GET    | `/api/tasks/:id/audit-logs`   | Riwayat task, urut kronologis                           |
| GET    | `/api/audit-logs/verify`      | Cek integritas hash chain                               |

Error berbentuk `{ error: { code, message, details? } }` dengan kode `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `INTERNAL_ERROR` (500).

### Alur status

```
to_do → pending → in_progress → done
```

Status dapat berpindah ke status mana pun: maju, mundur (`in_progress → pending`), melompat (`to_do → done`), atau dibuka kembali (`done → to_do`). Mengirim status yang sama dengan status saat ini tidak menghasilkan error, tidak mengubah apa pun, dan tidak membuat audit log (idempotent). Urutan `to_do → pending → in_progress → done` hanya menjadi urutan tampilan di UI.

### Audit log

Setiap entri berisi: `id`, `sequence`, `taskId`, `taskTitle` (snapshot), `action` (`task_created` / `status_changed` / `task_deleted`), `actor`, `fromStatus`, `toStatus`, `createdAt`, `prevHash`, dan `hash`.

- Dibuat **di dalam transaksi yang sama** dengan perubahan task. Jika salah satu gagal, keduanya tidak tersimpan.
- Hanya ada fungsi *append*. Tidak ada endpoint atau fungsi service untuk mengubah atau menghapus log.
- Saat task dihapus, log lamanya tetap ada dan ditambah satu entri `task_deleted`.

### Alur data dan konsistensi

1. `Database.mutate(fn)` mengantrikan setiap mutasi sehingga berjalan satu per satu.
2. Mutasi dikerjakan pada **salinan** (draft) state.
3. Draft ditulis ke disk dengan cara atomik (tulis file `.tmp`, lalu `rename`).
4. Hanya setelah tulisan berhasil, draft di-*commit* ke memori. Jika gagal, memori tidak berubah.

Dengan begitu status task dan audit log selalu sinkron, baik di memori maupun di disk.

### Frontend

- `App.tsx` memegang state dan memanggil API. Setelah setiap mutasi, data dimuat ulang dari backend (backend adalah sumber kebenaran).
- `TaskList` menampilkan status (badge), dropdown untuk mengubah status ke status mana pun, tombol History, dan Delete.
- `AuditLogPanel` tampil sebagai baris yang bisa dibuka per task, dengan kalimat seperti:
  `User "john.doe" changed Task "Prepare Invoice" status from "Pending" to "In Progress"` beserta waktunya.
- Dropdown **Acting as** menentukan actor untuk create, ubah status, dan delete.

---

## Asumsi

1. **Tidak ada auth.** Actor dipilih dari dropdown dan hanya divalidasi terhadap daftar hardcoded. Ini sesuai spesifikasi, tetapi berarti siapa pun bisa mengaku sebagai siapa pun.
2. **Status bebas berpindah.** Perubahan tidak dibatasi urutan, sesuai permintaan terbaru. Spesifikasi asli hanya mengizinkan urutan maju satu langkah; keputusan ini membalik aturan tersebut dan tetap dicatat di audit log.
3. **Log pembuatan task ikut dicatat** (`task_created`), dan penghapusan juga dicatat (`task_deleted`). Keduanya tidak diwajibkan, tetapi membuat riwayat lengkap.
4. **Judul maksimal 120 karakter, deskripsi maksimal 1000.** Ini batas wajar untuk UI dan body request dibatasi 32 KB.
5. **Satu instans backend.** Data disimpan di satu file JSON.
6. **Waktu** disimpan dalam UTC (ISO 8601) dan ditampilkan dalam zona waktu browser.
7. **Hapus task adalah hard delete** dari daftar task, tetapi riwayatnya dipertahankan (lihat poin 3).

---

## Trade-off

| Keputusan | Alasan | Harga yang dibayar |
|-----------|--------|--------------------|
| JSON file, bukan database | Tidak ada setup tambahan, cukup untuk skala tim kecil | Tidak bisa diskalakan horizontal; seluruh state dibaca ke memori dan ditulis ulang setiap mutasi (O(n)) |
| Antrian mutasi in-process | Sederhana dan menjamin urutan tanpa lock eksternal | Hanya berlaku dalam satu proses |
| Clone state per mutasi | Rollback gratis jika persist gagal | Biaya copy meningkat seiring jumlah data |
| Hash chain (SHA-256) | Mendeteksi perubahan manual pada file tanpa infrastruktur tambahan | Bukan pengganti tanda tangan atau storage append-only sungguhan; yang mengubah file dan chain-nya sekaligus tidak terdeteksi |
| Express 5 | Error dari handler `async` otomatis diteruskan ke error handler | Dependensi mayor yang lebih baru |
| Update via `PUT /status`, bukan `PATCH /tasks/:id` | Endpoint eksplisit untuk satu aksi domain | Tidak ada update judul/deskripsi (tidak diminta) |
| Frontend me-refetch setelah setiap aksi | Konsisten dengan backend, tanpa logika optimistik yang rumit | Satu round-trip tambahan per aksi |
| Tidak ada validasi frontend yang rumit | Backend adalah penentu; frontend hanya mencegah input kosong | UI bisa menampilkan error dari backend, bukan mencegah sejak awal |

---

## Jika ada waktu lebih

1. **Storage**: pindah ke SQLite atau PostgreSQL. Audit log menjadi tabel append-only dengan trigger yang menolak `UPDATE`/`DELETE`, dan `sequence` diberi constraint unik.
2. **Auth**: login sederhana (atau SSO internal) sehingga actor berasal dari identitas, bukan dropdown.
3. **Pagination dan filter** pada daftar task dan audit log.
4. **Optimistic concurrency**: field `version` pada task, dikirim di request, sehingga dua user yang mengubah task yang sama tidak saling menimpa (saat ini tidak ada pengecekan versi, sehingga last-write-wins berlaku).
5. **Test end-to-end** frontend (Playwright) dan CI.
6. **Idempotency key** untuk `POST /tasks` agar retry jaringan tidak membuat task ganda.
7. **Real-time update** (SSE) agar daftar ter-refresh saat user lain mengubah task.

---

## Jawaban pertanyaan teknis

### Bagaimana memastikan audit log tidak ter-modifikasi?

Ada empat lapisan:

1. **API**: tidak ada endpoint untuk mengubah atau menghapus audit log. Satu-satunya endpoint audit adalah `GET`.
2. **Kode**: modul `TaskService` hanya memiliki fungsi `appendAuditLog`. Data yang sudah di-commit dibekukan dengan `Object.freeze`, sehingga mutasi langsung di memori melempar error (ada test untuk ini).
3. **Hash chain**: setiap entri menyimpan `hash = SHA-256(isi entri + prevHash)`. Mengubah, menyisipkan, atau menghapus entri di tengah akan memutus rantai. `GET /api/audit-logs/verify` dan pemeriksaan saat startup mendeteksinya (ada test tampering pada file JSON).
4. **Penulisan atomik**: file ditulis ke `.tmp` lalu di-rename, sehingga crash di tengah penulisan tidak merusak file yang ada.

Batasannya: seseorang dengan akses tulis ke file bisa menulis ulang seluruh chain. Untuk mencegah itu diperlukan penyimpanan di luar kendali aplikasi (mis. tabel dengan izin hanya-insert, atau anchor hash yang disimpan di tempat lain).

### Bagian mana yang paling berisiko jika dipakai banyak user?

- **Penulisan seluruh file setiap mutasi.** Ukuran file dan waktu tulis tumbuh linear. Dengan banyak user dan banyak task, ini menjadi bottleneck dan membuat latensi naik.
- **Serialisasi di satu proses.** Antrian memastikan konsistensi, tetapi semua mutasi antre di satu titik. Jika backend di-scale ke beberapa instance, setiap instance punya antrian dan salinan data sendiri, sehingga data bisa saling menimpa. Ini adalah risiko terbesar secara arsitektur.
- **Tidak ada auth.** Actor bisa dipalsukan oleh siapa pun. Untuk tim internal ini diterima, tetapi tidak untuk penggunaan yang lebih luas.
- **Frontend tidak tahu versi task.** Dua user yang membuka task sama bisa melihat status lama. Perubahan terakhir menang tanpa peringatan, tetapi setiap perubahan tetap tercatat di audit log sehingga bisa ditelusuri.

### Jika task ini berkembang menjadi sistem besar, bagian mana yang di-refactor lebih dulu dan kenapa?

1. **Persistence** pertama. Ganti `Database` dengan repository berbasis database. Interface `TaskService` tidak perlu berubah, sehingga risikonya kecil dan dampaknya besar (skalabilitas dan integritas).
2. **Audit log sebagai modul/event terpisah.** Saat ini audit ditulis di transaksi yang sama. Ketika sistem membesar, sebaiknya menjadi event (outbox pattern) yang diproses terpisah untuk notifikasi, reporting, atau pencarian.
3. **Identitas actor.** Setelah ada auth, `actor` dari body request harus diganti dengan identitas dari token, supaya tidak bisa dipalsukan.
4. **Frontend state.** Ketika fitur bertambah, `App.tsx` akan terlalu besar. Pindahkan data fetching ke library seperti TanStack Query agar cache dan invalidasi tidak ditulis manual.

---

## Penggunaan AI

AI digunakan untuk membantu menulis sebagian besar kode awal, termasuk struktur backend, komponen React, dan test. Keputusan desain (status bebas berpindah, hash chain, antrian mutasi, pemisahan route/service/persistence) dan trade-off di atas adalah keputusan yang harus dipahami dan dijelaskan oleh pengembang.

Cara validasi:

- **Test otomatis**: 14 test di backend mencakup aturan transisi (termasuk mundur dan lompat), idempotensi, validasi input, append-only audit log, persistensi setelah restart, deteksi tampering, dan request paralel. Test sempat gagal (hang) karena Express 4 tidak meneruskan error dari handler `async`; masalah ini ditemukan lewat test lalu diperbaiki dengan upgrade ke Express 5.
- **Pemeriksaan tipe**: `tsc --noEmit` pada backend dan frontend, plus `vite build`.
- **Uji manual API**: membuat task, mengubah status maju, mundur, dan lompat, serta status yang sama, memverifikasi hash chain lewat endpoint, dan memastikan proxy frontend meneruskan request ke backend.
- **Review kode**: setiap bagian dibaca ulang untuk memastikan konsistensi antara domain, service, dan UI (misalnya, pesan error dan label status).
