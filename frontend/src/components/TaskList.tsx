import { Fragment } from "react";
import type { AuditLog, Task } from "../api/types";
import { AuditLogPanel } from "./AuditLogPanel";
import { STATUS_LABELS, STATUS_ORDER, formatDateTime, nextStatus } from "../lib/format";

interface Props {
  tasks: Task[];
  busyTaskIds: Set<string>;
  expandedIds: Set<string>;
  auditByTask: Record<string, AuditLog[] | undefined>;
  auditErrors: Record<string, string | null>;
  onAdvance: (task: Task) => void;
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
          const next = nextStatus(task.status);
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
                  <StatusStepper current={task.status} />
                </td>
                <td className="small">{formatDateTime(task.updatedAt)}</td>
                <td className="actions">
                  <button
                    type="button"
                    disabled={busy || next === null}
                    onClick={() => props.onAdvance(task)}
                    title={next ? `Move to ${STATUS_LABELS[next]}` : "Task already done"}
                  >
                    {next ? `→ ${STATUS_LABELS[next]}` : "Completed"}
                  </button>
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

function StatusStepper({ current }: { current: Task["status"] }) {
  const currentIndex = STATUS_ORDER.indexOf(current);
  return (
    <ol className="stepper" aria-label={`Progress: ${STATUS_LABELS[current]}`}>
      {STATUS_ORDER.map((status, index) => (
        <li
          key={status}
          className={index <= currentIndex ? "reached" : ""}
          title={STATUS_LABELS[status]}
        />
      ))}
    </ol>
  );
}
