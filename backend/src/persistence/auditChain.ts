import { createHash } from "node:crypto";
import type { AuditLog } from "../domain/types.js";

/** Fields included in the hash. Order and names must stay fixed so hashes remain stable. */
export type AuditHashInput = Omit<AuditLog, "hash">;

export const GENESIS_HASH = "0".repeat(64);

export function computeAuditHash(entry: AuditHashInput): string {
  const canonical = JSON.stringify([
    entry.id,
    entry.sequence,
    entry.taskId,
    entry.taskTitle,
    entry.action,
    entry.actor,
    entry.fromStatus,
    entry.toStatus,
    entry.createdAt,
    entry.prevHash,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

export interface ChainVerification {
  valid: boolean;
  /** First sequence number that failed verification, if any. */
  brokenAtSequence?: number;
}

/** Verifies that no entry was modified, inserted, or removed from the middle of the chain. */
export function verifyAuditChain(logs: readonly AuditLog[]): ChainVerification {
  let expectedPrev = GENESIS_HASH;
  for (const [index, log] of logs.entries()) {
    const expectedSequence = index + 1;
    if (log.sequence !== expectedSequence || log.prevHash !== expectedPrev) {
      return { valid: false, brokenAtSequence: log.sequence };
    }
    if (computeAuditHash(log) !== log.hash) {
      return { valid: false, brokenAtSequence: log.sequence };
    }
    expectedPrev = log.hash;
  }
  return { valid: true };
}
