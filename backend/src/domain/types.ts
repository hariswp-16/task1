import type { ActorId } from "./actors.js";
import type { TaskStatus } from "./status.js";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction = "task_created" | "status_changed" | "task_deleted";

/**
 * Audit entries are append-only.
 * `taskTitle` is stored as a snapshot so the log stays readable after the task is deleted.
 * `prevHash` and `hash` form a hash chain to detect manual edits to the file.
 */
export interface AuditLog {
  id: string;
  sequence: number;
  taskId: string;
  taskTitle: string;
  action: AuditAction;
  actor: ActorId;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  createdAt: string;
  prevHash: string;
  hash: string;
}

export interface DatabaseState {
  tasks: Task[];
  auditLogs: AuditLog[];
}
