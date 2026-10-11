// Tipe ini mencerminkan respons backend (lihat backend/src/domain/types.ts).
export type TaskStatus = "to_do" | "pending" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction = "task_created" | "status_changed" | "task_deleted";

export interface AuditLog {
  id: string;
  sequence: number;
  taskId: string;
  taskTitle: string;
  action: AuditAction;
  actor: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  createdAt: string;
  prevHash: string;
  hash: string;
}

export interface Actor {
  id: string;
  name: string;
}

export interface Meta {
  actors: Actor[];
  statuses: TaskStatus[];
}
