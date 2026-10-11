import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api/client";
import type { Actor, AuditLog, Meta, Task } from "./api/types";
import { ActorSelect } from "./components/ActorSelect";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import { STATUS_LABELS, nextStatus } from "./lib/format";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [actorId, setActorId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyTaskIds, setBusyTaskIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [auditByTask, setAuditByTask] = useState<Record<string, AuditLog[] | undefined>>({});
  const [auditErrors, setAuditErrors] = useState<Record<string, string | null>>({});

  const actors: Actor[] = meta?.actors ?? [];

  const loadTasks = useCallback(async () => {
    setTasks(await api.listTasks());
  }, []);

  const loadAudit = useCallback(async (taskId: string) => {
    try {
      const logs = await api.listAuditLogs(taskId);
      setAuditByTask((prev) => ({ ...prev, [taskId]: logs }));
      setAuditErrors((prev) => ({ ...prev, [taskId]: null }));
    } catch (err) {
      setAuditErrors((prev) => ({ ...prev, [taskId]: errorMessage(err) }));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.getMeta();
        setMeta(m);
        setActorId(m.actors[0]?.id ?? "");
        await loadTasks();
      } catch (err) {
        setPageError(`Cannot reach the backend: ${errorMessage(err)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadTasks]);

  /** After every mutation: reload tasks and any history panel that is open. */
  async function refreshAfterMutation(taskId?: string) {
    await loadTasks();
    if (taskId && expandedIds.has(taskId)) {
      await loadAudit(taskId);
    }
  }

  function setBusy(taskId: string, busy: boolean) {
    setBusyTaskIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  async function handleCreate(input: { title: string; description: string }) {
    setCreating(true);
    setNotice(null);
    try {
      await api.createTask({ ...input, actor: actorId });
      await loadTasks();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleAdvance(task: Task) {
    const next = nextStatus(task.status);
    if (!next) return;
    setBusy(task.id, true);
    setNotice(null);
    try {
      const result = await api.changeStatus(task.id, next, actorId);
      if (!result.changed) {
        setNotice(`"${task.title}" is already ${STATUS_LABELS[next]}.`);
      }
      await refreshAfterMutation(task.id);
    } catch (err) {
      // The backend is the source of truth: show the rejection reason and reload fresh data.
      setNotice(err instanceof ApiError ? err.message : errorMessage(err));
      await loadTasks().catch(() => undefined);
    } finally {
      setBusy(task.id, false);
    }
  }

  async function handleDelete(task: Task) {
    if (!window.confirm(`Delete task "${task.title}"? Its history will be kept in the audit log.`)) return;
    setBusy(task.id, true);
    setNotice(null);
    try {
      await api.deleteTask(task.id, actorId);
      setExpandedIds((prev) => without(prev, task.id));
      await loadTasks();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(task.id, false);
    }
  }

  async function handleToggleAudit(task: Task) {
    if (expandedIds.has(task.id)) {
      setExpandedIds((prev) => without(prev, task.id));
      return;
    }
    setExpandedIds((prev) => new Set(prev).add(task.id));
    await loadAudit(task.id);
  }

  return (
    <main className="container">
      <header className="page-header">
        <div>
          <h1>Mini Task Manager</h1>
          <p className="muted small">Status moves one step at a time: To Do → Pending → In Progress → Done.</p>
        </div>
        {meta && <ActorSelect actors={actors} value={actorId} onChange={setActorId} />}
      </header>

      {pageError && <p className="error card">{pageError}</p>}
      {notice && (
        <p className="notice card" role="alert">
          {notice}{" "}
          <button type="button" className="link" onClick={() => setNotice(null)}>
            dismiss
          </button>
        </p>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        meta && (
          <div className="layout">
            <TaskForm disabled={creating || !actorId} onSubmit={handleCreate} />
            <section>
              <h2>Tasks ({tasks.length})</h2>
              <TaskList
                tasks={tasks}
                busyTaskIds={busyTaskIds}
                expandedIds={expandedIds}
                auditByTask={auditByTask}
                auditErrors={auditErrors}
                onAdvance={handleAdvance}
                onDelete={handleDelete}
                onToggleAudit={handleToggleAudit}
              />
            </section>
          </div>
        )
      )}
    </main>
  );
}

function without(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  next.delete(value);
  return next;
}
