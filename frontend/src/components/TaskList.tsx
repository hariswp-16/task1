import { Fragment } from "react";
import type { AuditLog, Task, TaskStatus } from "../api/types";
import { AuditLogPanel } from "./AuditLogPanel";
import { STATUS_LABELS, STATUS_ORDER, formatDateTime } from "../lib/format";

interface Props {
  tasks: Task[];
  busyTaskIds: Set<string>;
  expandedIds: Set<string>;
  auditByTask: Record<string, AuditLog[] | undefined>;
  auditErrors: Record<string, string | null>;
  onChangeStatus: (task: Task, status: TaskStatus) => void;
  onDelete: (task: Task) => void;
  onToggleAudit: (task: Task) => void;
}

export function TaskList(props: Props) {
  if (props.tasks.length === 0) {
    return <p className="muted card">No tasks yet. Create one to get started.</p>;
  }

  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>Task</th>
          <th>Status</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {props.tasks.map((task) => {
          const busy = props.busyTaskIds.has(task.id);
          const expanded = props.expandedIds.has(task.id);
          return (
            <Fragment key={task.id}>
              <tr>
                <td>
                  <div className="task-title">{task.title}</div>
                  {task.description && <div className="muted small">{task.description}</div>}
                </td>
                <td>
                  <StatusBadge status={task.status} />
                </td>
                <td className="small">{formatDateTime(task.updatedAt)}</td>
                <td className="actions">
                  <select
                    aria-label={`Change status of ${task.title}`}
                    value={task.status}
                    disabled={busy}
                    onChange={(e) => props.onChangeStatus(task, e.target.value as TaskStatus)}
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="secondary" onClick={() => props.onToggleAudit(task)}>
                    {expanded ? "Hide history" : "History"}
                  </button>
                  <button type="button" className="danger" disabled={busy} onClick={() => props.onDelete(task)}>
                    Delete
                  </button>
                </td>
              </tr>
              {expanded && (
                <tr className="audit-row">
                  <td colSpan={4}>
                    <AuditLogPanel
                      logs={props.auditByTask[task.id]}
                      error={props.auditErrors[task.id] ?? null}
                      taskTitle={task.title}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export function StatusBadge({ status }: { status: Task["status"] }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}
