/**
 * Task statuses and their transition rules.
 *
 * Any status may move to any other status. Setting the status to its current
 * value is a no-op (idempotent) and produces no audit log.
 */
export const TASK_STATUSES = ["to_do", "pending", "in_progress", "done"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

export type TransitionCheck =
  | { kind: "unchanged" } // same status: idempotent, no change
  | { kind: "allowed" };

export function checkTransition(from: TaskStatus, to: TaskStatus): TransitionCheck {
  return from === to ? { kind: "unchanged" } : { kind: "allowed" };
}
