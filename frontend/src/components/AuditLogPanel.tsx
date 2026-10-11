import type { AuditLog } from "../api/types";
import { describeAuditLog, formatDateTime } from "../lib/format";

interface Props {
  logs: AuditLog[] | undefined;
  error: string | null;
  taskTitle: string;
}

/** History per task, shown chronologically (oldest first). */
export function AuditLogPanel({ logs, error, taskTitle }: Props) {
  if (error) return <p className="error">{error}</p>;
  if (!logs) return <p className="muted">Loading history…</p>;
  if (logs.length === 0) return <p className="muted">No history yet.</p>;

  return (
    <ol className="audit-list" aria-label={`Audit log for ${taskTitle}`}>
      {logs.map((log) => (
        <li key={log.id}>
          <div>
            {describeAuditLog(log)}
          </div>
          <time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time>
        </li>
      ))}
    </ol>
  );
}
