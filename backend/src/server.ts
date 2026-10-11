import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./http/app.js";
import { Database } from "./persistence/database.js";
import { verifyAuditChain } from "./persistence/auditChain.js";
import { TaskService } from "./services/taskService.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.DATA_FILE ?? path.resolve(here, "../data/db.json");
const port = Number(process.env.PORT ?? 3001);

const db = new Database(dataFile);
await db.load();

const integrity = verifyAuditChain(db.read().auditLogs);
if (!integrity.valid) {
  console.warn(`[audit] WARNING: hash chain broken starting at sequence ${integrity.brokenAtSequence}.`);
}

const service = new TaskService(db);
const app = createApp(service);

app.listen(port, "0.0.0.0", () => {
  console.log(`Task manager API listening on http://0.0.0.0:${port} (data: ${dataFile})`);
});
