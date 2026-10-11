import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Browser hanya memanggil path relatif /api; Vite meneruskannya ke backend.
// Dengan begitu tidak ada URL localhost yang tertanam di kode client.
const backend = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3001";

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // izinkan akses dari preview host
    proxy: {
      "/api": { target: backend, changeOrigin: true },
    },
  },
});
