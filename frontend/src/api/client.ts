import type { AuditLog, Meta, Task, TaskStatus } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body?.error ?? {};
    throw new ApiError(res.status, error.code ?? "UNKNOWN", error.message ?? `Request gagal (${res.status})`);
  }
  return body as T;
}

export const api = {
  getMeta: () => request<Meta>("/meta"),

  listTasks: () => request<{ data: Task[] }>("/tasks").then((r) => r.data),

  createTask: (input: { title: string; description: string; actor: string }) =>
    request<{ data: Task }>("/tasks", { method: "POST", body: JSON.stringify(input) }).then((r) => r.data),

  changeStatus: (id: string, status: TaskStatus, actor: string) =>
    request<{ data: Task; changed: boolean }>(`/tasks/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, actor }),
    }),

  deleteTask: (id: string, actor: string) =>
    request<void>(`/tasks/${id}`, { method: "DELETE", body: JSON.stringify({ actor }) }),

  listAuditLogs: (id: string) =>
    request<{ data: AuditLog[] }>(`/tasks/${id}/audit-logs`).then((r) => r.data),
};
