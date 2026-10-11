import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTestContext } from "./helpers.js";
import { Database } from "../persistence/database.js";
import { TaskService } from "../services/taskService.js";
import { AppError } from "../errors.js";

async function expectAppError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (err: unknown) => err instanceof AppError && err.code === code);
}

test("create task menghasilkan task dan audit log pertama", async () => {
  const { service } = await createTestContext();
  const task = await service.createTask({ title: "  Prepare Invoice ", actor: "john.doe" });
  assert.equal(task.title, "Prepare Invoice");
  assert.equal(task.status, "to_do");

  const logs = service.listAuditLogs(task.id);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.action, "task_created");
  assert.equal(logs[0]?.fromStatus, null);
  assert.equal(logs[0]?.toStatus, "to_do");
  assert.equal(logs[0]?.actor, "john.doe");
});

test("perubahan status menambah log baru dan tidak menghapus log lama", async () => {
  const { service } = await createTestContext();
  const task = await service.createTask({ title: "Task A", actor: "john.doe" });
  await service.changeStatus(task.id, "pending", "jane.smith");
  await service.changeStatus(task.id, "in_progress", "budi.santoso");

  const logs = service.listAuditLogs(task.id);
  assert.deepEqual(
    logs.map((l) => [l.fromStatus, l.toStatus, l.actor]),
    [
      [null, "to_do", "john.doe"],
      ["to_do", "pending", "jane.smith"],
      ["pending", "in_progress", "budi.santoso"],
    ],
  );
  assert.deepEqual(logs.map((l) => l.sequence), [1, 2, 3]);
});

test("update ke status yang sama tidak membuat audit log baru", async () => {
  const { service } = await createTestContext();
  const task = await service.createTask({ title: "Task B", actor: "john.doe" });
  await service.changeStatus(task.id, "pending", "john.doe");
  const result = await service.changeStatus(task.id, "pending", "john.doe");
  assert.equal(result.changed, false);
  assert.equal(service.listAuditLogs(task.id).length, 2);
});

test("status dapat berpindah ke status mana pun, termasuk mundur dan lompat", async () => {
  const { service } = await createTestContext();
  const task = await service.createTask({ title: "Task C", actor: "john.doe" });
  await service.changeStatus(task.id, "in_progress", "jane.smith");
  const back = await service.changeStatus(task.id, "pending", "budi.santoso");
  assert.equal(back.changed, true);
  assert.equal(service.getTask(task.id).status, "pending");
  await service.changeStatus(task.id, "done", "john.doe");
  const reopened = await service.changeStatus(task.id, "to_do", "sari.wijaya");
  assert.equal(reopened.task.status, "to_do");

  const logs = service.listAuditLogs(task.id);
  assert.deepEqual(
    logs.map((l) => [l.fromStatus, l.toStatus]),
    [
      [null, "to_do"],
      ["to_do", "in_progress"],
      ["in_progress", "pending"],
      ["pending", "done"],
      ["done", "to_do"],
    ],
  );
  assert.equal(service.verifyAuditIntegrity().valid, true);
});

test("validasi input: judul kosong, status tidak dikenal, actor tidak dikenal", async () => {
  const { service } = await createTestContext();
  await expectAppError(service.createTask({ title: "   ", actor: "john.doe" }), "VALIDATION_ERROR");
  await expectAppError(service.createTask({ title: "x", actor: "hacker" }), "VALIDATION_ERROR");
  const task = await service.createTask({ title: "x", actor: "john.doe" });
  await expectAppError(service.changeStatus(task.id, "archived", "john.doe"), "VALIDATION_ERROR");
  await expectAppError(service.changeStatus("missing", "pending", "john.doe"), "NOT_FOUND");
});

test("delete task tetap mempertahankan audit log lama dan menambah log delete", async () => {
  const { service } = await createTestContext();
  const task = await service.createTask({ title: "Task D", actor: "john.doe" });
  await service.changeStatus(task.id, "pending", "john.doe");
  await service.deleteTask(task.id, "sari.wijaya");

  assert.throws(() => service.getTask(task.id), (err: unknown) => err instanceof AppError && err.code === "NOT_FOUND");
  const logs = service.listAuditLogs(task.id);
  assert.equal(logs.length, 3);
  assert.equal(logs[2]?.action, "task_deleted");
  assert.equal(logs[2]?.taskTitle, "Task D");
  assert.equal(service.verifyAuditIntegrity().valid, true);
});

test("audit log yang sudah di-commit beku (tidak bisa dimutasi di memori)", async () => {
  const { service, db } = await createTestContext();
  const task = await service.createTask({ title: "Task E", actor: "john.doe" });
  const [log] = db.read().auditLogs;
  assert.ok(log);
  assert.equal(Object.isFrozen(log), true);
  assert.throws(() => {
    (log as { actor: string }).actor = "someone.else";
  }, TypeError);
  assert.equal(service.listAuditLogs(task.id)[0]?.actor, "john.doe");
});

test("data dan audit log bertahan setelah restart (persistence JSON)", async () => {
  const { file, service } = await createTestContext();
  const task = await service.createTask({ title: "Persist", actor: "john.doe" });
  await service.changeStatus(task.id, "pending", "jane.smith");

  const db2 = new Database(file);
  await db2.load();
  const service2 = new TaskService(db2);
  assert.equal(service2.getTask(task.id).status, "pending");
  assert.equal(service2.listAuditLogs(task.id).length, 2);
  assert.equal(service2.verifyAuditIntegrity().valid, true);
});

test("tampering pada file JSON terdeteksi oleh hash chain", async () => {
  const { file, service, db } = await createTestContext();
  const task = await service.createTask({ title: "Tamper", actor: "john.doe" });
  await service.changeStatus(task.id, "pending", "jane.smith");

  const raw = JSON.parse(await readFile(file, "utf8"));
  raw.auditLogs[1].actor = "budi.santoso"; // ubah aktor secara manual
  const { writeFile } = await import("node:fs/promises");
  await writeFile(file, JSON.stringify(raw), "utf8");

  const db2 = new Database(file);
  await db2.load();
  const check = new TaskService(db2).verifyAuditIntegrity();
  assert.equal(check.valid, false);
  assert.equal(check.brokenAtSequence, 2);
  assert.ok(db);
});

test("request paralel tidak membuat sequence audit log duplikat", async () => {
  const { service } = await createTestContext();
  const task = await service.createTask({ title: "Concurrent", actor: "john.doe" });
  await Promise.all([
    service.changeStatus(task.id, "pending", "john.doe"),
    service.changeStatus(task.id, "pending", "jane.smith"),
    service.changeStatus(task.id, "pending", "budi.santoso"),
  ]);
  const logs = service.listAuditLogs(task.id);
  assert.deepEqual(logs.map((l) => l.sequence), [1, 2]);
  assert.equal(service.verifyAuditIntegrity().valid, true);
});
