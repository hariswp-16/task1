import type { AuditLog, TaskStatus } from "../api/types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: "To Do",
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
};

export const STATUS_ORDER: TaskStatus[] = ["to_do", "pending", "in_progress", "done"];

/** Format waktu lokal: "2025-01-01 10:00" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Human-readable sentence, following the format in the spec. */
export function describeAuditLog(log: AuditLog): string {
  const who = `User "${log.actor}"`;
  const task = `Task "${log.taskTitle}"`;
  switch (log.action) {
    case "task_created":
      return `${who} created ${task} with status "${STATUS_LABELS[log.toStatus ?? "to_do"]}"`;
    case "status_changed":
      return `${who} changed ${task} status from "${STATUS_LABELS[log.fromStatus ?? "to_do"]}" to "${STATUS_LABELS[log.toStatus ?? "to_do"]}"`;
    case "task_deleted":
      return `${who} deleted ${task} (last status "${STATUS_LABELS[log.fromStatus ?? "to_do"]}")`;
  }
}
