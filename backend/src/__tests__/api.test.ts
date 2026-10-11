import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestContext, startServer } from "./helpers.js";

let baseUrl = "";
let closeServer: () => Promise<void> = async () => {};

before(async () => {
  const ctx = await createTestContext();
  const server = await startServer(ctx.app);
  baseUrl = server.baseUrl;
  closeServer = server.close;
});

after(async () => {
  await closeServer();
});

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

test("alur API end-to-end", async () => {
  const created = await call("POST", "/api/tasks", { title: "API task", actor: "john.doe" });
  assert.equal(created.status, 201);
  const id = created.json.data.id as string;

  const list = await call("GET", "/api/tasks");
  assert.equal(list.json.data.length, 1);

  const ok = await call("PUT", `/api/tasks/${id}/status`, { status: "pending", actor: "jane.smith" });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.changed, true);

  const same = await call("PUT", `/api/tasks/${id}/status`, { status: "pending", actor: "jane.smith" });
  assert.equal(same.status, 200);
  assert.equal(same.json.changed, false);

  const bad = await call("PUT", `/api/tasks/${id}/status`, { status: "done", actor: "jane.smith" });
  assert.equal(bad.status, 409);
  assert.equal(bad.json.error.code, "INVALID_TRANSITION");

  const logs = await call("GET", `/api/tasks/${id}/audit-logs`);
  assert.equal(logs.json.data.length, 2);

  const verify = await call("GET", "/api/audit-logs/verify");
  assert.equal(verify.json.data.valid, true);

  const del = await call("DELETE", `/api/tasks/${id}`, { actor: "john.doe" });
  assert.equal(del.status, 204);
  const afterDelete = await call("GET", `/api/tasks/${id}/audit-logs`);
  assert.equal(afterDelete.json.data.length, 3);
});

test("error API: validasi dan 404", async () => {
  const noTitle = await call("POST", "/api/tasks", { actor: "john.doe" });
  assert.equal(noTitle.status, 400);
  assert.equal(noTitle.json.error.code, "VALIDATION_ERROR");

  const unknownTask = await call("GET", "/api/tasks/nope/audit-logs");
  assert.equal(unknownTask.status, 404);

  const route = await call("GET", "/api/unknown");
  assert.equal(route.status, 404);
});
