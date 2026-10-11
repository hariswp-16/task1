import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTransition } from "../domain/status.js";

test("any status may move to any other status", () => {
  assert.deepEqual(checkTransition("to_do", "pending"), { kind: "allowed" });
  assert.deepEqual(checkTransition("in_progress", "pending"), { kind: "allowed" }); // backward
  assert.deepEqual(checkTransition("done", "to_do"), { kind: "allowed" }); // reopen
  assert.deepEqual(checkTransition("to_do", "done"), { kind: "allowed" }); // skip
});

test("same status is unchanged (idempotent)", () => {
  assert.deepEqual(checkTransition("pending", "pending"), { kind: "unchanged" });
});
