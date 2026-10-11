import { randomUUID } from "node:crypto";
import { isActorId, type ActorId } from "../domain/actors.js";
import { checkTransition, isTaskStatus, type TaskStatus } from "../domain/status.js";
import type { AuditLog, DatabaseState, Task } from "../domain/types.js";
import { computeAuditHash, GENESIS_HASH, verifyAuditChain } from "../persistence/auditChain.js";
import type { Database } from "../persistence/database.js";
import { invalidTransition, notFound, validationError } from "../errors.js";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;

export interface CreateTaskInput {
  title: unknown;
  description?: unknown;
  actor: unknown;
}

export interface ChangeStatusResult {
  task: Task;
  /** false if the requested status equals the current one (no new log). */
  changed: boolean;
}

/**
 * Holds all domain rules: input validation, status flow, and audit log creation.
 * Every mutation writes the task and its audit log in one transaction (lihat Database.mutate),
 * so task status and audit log are always in sync.
 */
export class TaskService {
  constructor(private readonly db: Database) {}

  listTasks(): Task[] {
    return [...this.db.read().tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  getTask(id: string): Task {
    const task = this.db.read().tasks.find((t) => t.id === id);
    if (!task) {
      throw notFound(`Task "${id}" not found.`);
    }
    return task;
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const title = parseTitle(input.title);
    const description = parseDescription(input.description);
    const actor = parseActor(input.actor);
    const now = new Date().toISOString();

    return this.db.mutate((draft) => {
      const task: Task = {
        id: randomUUID(),
        title,
        description,
        status: "to_do",
        createdAt: now,
        updatedAt: now,
      };
      draft.tasks.push(task);
      appendAuditLog(draft, {
        taskId: task.id,
        taskTitle: task.title,
        action: "task_created",
        actor,
        fromStatus: null,
        toStatus: task.status,
        createdAt: now,
      });
      return task;
    });
  }

  async changeStatus(id: string, rawStatus: unknown, rawActor: unknown): Promise<ChangeStatusResult> {
    if (!isTaskStatus(rawStatus)) {
      throw validationError("Invalid status.", { allowed: ["to_do", "pending", "in_progress", "done"] });
    }
    const target: TaskStatus = rawStatus;
    const actor = parseActor(rawActor);

    return this.db.mutate((draft) => {
      const task = draft.tasks.find((t) => t.id === id);
      if (!task) {
        throw notFound(`Task "${id}" not found.`);
      }

      const check = checkTransition(task.status, target);
      if (check.kind === "unchanged") {
        // Idempotent: no state change and no new audit log.
        return { task, changed: false };
      }
      if (check.kind === "forbidden") {
        throw invalidTransition(check.reason);
      }

      const now = new Date().toISOString();
      const fromStatus = task.status;
      task.status = target;
      task.updatedAt = now;

      appendAuditLog(draft, {
        taskId: task.id,
        taskTitle: task.title,
        action: "status_changed",
        actor,
        fromStatus,
        toStatus: target,
        createdAt: now,
      });
      return { task: { ...task }, changed: true };
    });
  }

  async deleteTask(id: string, rawActor: unknown): Promise<void> {
    const actor = parseActor(rawActor);

    await this.db.mutate((draft) => {
      const index = draft.tasks.findIndex((t) => t.id === id);
      if (index === -1) {
        throw notFound(`Task "${id}" not found.`);
      }
      const [task] = draft.tasks.splice(index, 1);
      if (!task) return;
      // Audit logs of the deleted task are NOT removed; a new entry is appended.
      appendAuditLog(draft, {
        taskId: task.id,
        taskTitle: task.title,
        action: "task_deleted",
        actor,
        fromStatus: task.status,
        toStatus: null,
        createdAt: new Date().toISOString(),
      });
    });
  }

  /** History per task, in chronological order (oldest first). */
  listAuditLogs(taskId: string): AuditLog[] {
    const { tasks, auditLogs } = this.db.read();
    const logs = auditLogs.filter((log) => log.taskId === taskId);
    const exists = tasks.some((t) => t.id === taskId);
    if (!exists && logs.length === 0) {
      throw notFound(`Task "${taskId}" not found.`);
    }
    return logs;
  }

  verifyAuditIntegrity() {
    return verifyAuditChain(this.db.read().auditLogs);
  }
}

interface NewAuditInput {
  taskId: string;
  taskTitle: string;
  action: AuditLog["action"];
  actor: ActorId;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  createdAt: string;
}

/** Appends a new audit log to the end of the draft. There is no function to update or delete logs. */
function appendAuditLog(draft: DatabaseState, input: NewAuditInput): void {
  const previous = draft.auditLogs[draft.auditLogs.length - 1];
  const sequence = (previous?.sequence ?? 0) + 1;
  const prevHash = previous?.hash ?? GENESIS_HASH;
  const base = { id: randomUUID(), sequence, prevHash, ...input };
  const entry: AuditLog = { ...base, hash: computeAuditHash(base) };
  draft.auditLogs.push(entry);
}

function parseTitle(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validationError("Task title is required.");
  }
  const title = value.trim();
  if (title.length > MAX_TITLE_LENGTH) {
    throw validationError(`Task title must be at most ${MAX_TITLE_LENGTH} characters.`);
  }
  return title;
}

function parseDescription(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw validationError("Description must be a string.");
  }
  const description = value.trim();
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw validationError(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`);
  }
  return description;
}

function parseActor(value: unknown): ActorId {
  if (!isActorId(value)) {
    throw validationError("Unknown actor.");
  }
  return value;
}
