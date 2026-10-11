import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../http/app.js";
import { Database } from "../persistence/database.js";
import { TaskService } from "../services/taskService.js";

export async function createTestContext() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "task-test-"));
  const file = path.join(dir, "db.json");
  const db = new Database(file);
  await db.load();
  const service = new TaskService(db);
  return { dir, file, db, service, app: createApp(service) };
}

export async function startServer(app: ReturnType<typeof createApp>): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections(); // tutup koneksi keep-alive agar proses test bisa selesai
      }),
  };
}
