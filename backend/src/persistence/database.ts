import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DatabaseState } from "../domain/types.js";

const EMPTY_STATE: DatabaseState = { tasks: [], auditLogs: [] };

/**
 * Simple JSON-file-backed storage.
 *
 * - All mutations run sequentially (serialized) through `mutate`, so no two writes
 *   overwrite each other within one process.
 * - Mutations work on a copy (draft). The result is committed to memory only
 *   after the file is successfully written, so memory and disk never diverge.
 * - File writes are atomic: write to a temp file, then rename.
 */
export class Database {
  private state: DatabaseState = structuredClone(EMPTY_STATE);
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as DatabaseState;
      this.state = {
        tasks: parsed.tasks ?? [],
        auditLogs: (parsed.auditLogs ?? []).map((log) => Object.freeze(log)),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      this.state = structuredClone(EMPTY_STATE);
    }
  }

  /** Read snapshot. Callers must not mutate it directly. */
  read(): Readonly<DatabaseState> {
    return this.state;
  }

  mutate<T>(fn: (draft: DatabaseState) => T): Promise<T> {
    const run = this.queue.then(async () => {
      const draft = structuredClone(this.state);
      const result = fn(draft);
      await this.persist(draft);
      this.state = {
        tasks: draft.tasks,
        // Committed audit entries are frozen so they cannot be modified in memory.
        auditLogs: draft.auditLogs.map((log) => Object.freeze(log)),
      };
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async persist(state: DatabaseState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmpPath, JSON.stringify(state, null, 2), "utf8");
    await rename(tmpPath, this.filePath);
  }
}
