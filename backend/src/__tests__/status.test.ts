import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTransition } from "../domain/status.js";

test("izinkan transisi satu langkah ke depan", () => {
  assert.deepEqual(checkTransition("to_do", "pending"), { kind: "allowed" });
  assert.deepEqual(checkTransition("pending", "in_progress"), { kind: "allowed" });
  assert.deepEqual(checkTransition("in_progress", "done"), { kind: "allowed" });
});

test("tolak lompatan dan mundur", () => {
  assert.equal(checkTransition("to_do", "done").kind, "forbidden");
  assert.equal(checkTransition("to_do", "in_progress").kind, "forbidden");
  assert.equal(checkTransition("done", "to_do").kind, "forbidden");
  assert.equal(checkTransition("in_progress", "pending").kind, "forbidden");
});

test("status sama dianggap unchanged (idempotent)", () => {
  assert.deepEqual(checkTransition("pending", "pending"), { kind: "unchanged" });
});
