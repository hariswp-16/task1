import express, { type NextFunction, type Request, type Response } from "express";
import { ACTORS } from "../domain/actors.js";
import { TASK_STATUSES } from "../domain/status.js";
import { AppError } from "../errors.js";
import type { TaskService } from "../services/taskService.js";

export function createApp(service: TaskService) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/meta", (_req, res) => {
    res.json({ actors: ACTORS, statuses: TASK_STATUSES });
  });

  app.get("/api/tasks", (_req, res) => {
    res.json({ data: service.listTasks() });
  });

  app.post("/api/tasks", async (req, res) => {
    const task = await service.createTask(req.body ?? {});
    res.status(201).json({ data: task });
  });

  app.put("/api/tasks/:id/status", async (req, res) => {
    const result = await service.changeStatus(
      req.params.id ?? "",
      req.body?.status,
      req.body?.actor,
    );
    // 200 in both cases; `changed` tells the client whether a new log was created.
    res.json({ data: result.task, changed: result.changed });
  });

  app.delete("/api/tasks/:id", async (req, res) => {
    await service.deleteTask(req.params.id ?? "", req.body?.actor);
    res.status(204).end();
  });

  app.get("/api/tasks/:id/audit-logs", (req, res) => {
    res.json({ data: service.listAuditLogs(req.params.id ?? "") });
  });

  app.get("/api/audit-logs/verify", (_req, res) => {
    res.json({ data: service.verifyAuditIntegrity() });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } });
  });

  // Central error handler: AppError maps to its status; anything else becomes a 500 without leaking details.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Malformed JSON body." } });
      return;
    }
    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Internal server error." } });
  });

  return app;
}
