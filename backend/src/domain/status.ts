/**
 * Task statuses and their transition rules.
 *
 * The allowed flow is one-directional and one step at a time:
 *   to_do -> pending -> in_progress -> done
 * A status cannot be skipped (e.g. to_do -> done) and cannot move backwards.
 */
export const TASK_STATUSES = ["to_do", "pending", "in_progress", "done"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

export type TransitionCheck =
  | { kind: "unchanged" } // same status: idempotent, no change
  | { kind: "allowed" }
  | { kind: "forbidden"; reason: string };

export function checkTransition(from: TaskStatus, to: TaskStatus): TransitionCheck {
  if (from === to) {
    return { kind: "unchanged" };
  }

  const fromIndex = TASK_STATUSES.indexOf(from);
  const toIndex = TASK_STATUSES.indexOf(to);

  if (toIndex === fromIndex + 1) {
    return { kind: "allowed" };
  }

  return {
    kind: "forbidden",
    reason: `Transition from "${from}" to "${to}" is not allowed. Status may only move to the next step: ${TASK_STATUSES.join(" -> ")}.`,
  };
}
