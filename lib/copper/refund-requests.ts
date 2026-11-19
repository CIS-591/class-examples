// Refund requests (Module 4): what the Refund Desk agent submits, and what a
// Copper Crew supervisor approves or denies on the Refund Console. Refunds the
// rules allow outright are paid at once; refunds over the approval limit wait
// as "pending" until a person decides. Kept in a JSON file on this computer
// (.data/refund-requests.json, not in git), so they survive a restart.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { RefundDecision, RefundRequest } from "@/lib/copper/refunds";

export type RefundStatus = "paid" | "pending" | "approved" | "denied";

export type RefundRecord = RefundRequest & {
  /** Like "RF-1001": the number the customer is given. */
  id: string;
  createdAt: string;
  amountUsd: number;
  rule: string;
  source: string;
  status: RefundStatus;
  /** When a supervisor approved or denied it. */
  decidedAt?: string;
};

/**
 * The JSON file. REFUND_REQUESTS_FILE moves it (tests and npm run eval do).
 * turbopackIgnore: it's data written at run time, not part of the build.
 */
const storeFile = () =>
  process.env.REFUND_REQUESTS_FILE ??
  join(
    /* turbopackIgnore: true */ process.cwd(),
    ".data",
    "refund-requests.json",
  );

function read(): RefundRecord[] {
  try {
    return JSON.parse(
      readFileSync(/* turbopackIgnore: true */ storeFile(), "utf8"),
    );
  } catch {
    return [];
  }
}

function write(records: RefundRecord[]) {
  mkdirSync(/* turbopackIgnore: true */ dirname(storeFile()), {
    recursive: true,
  });
  writeFileSync(
    /* turbopackIgnore: true */ storeFile(),
    `${JSON.stringify(records, null, 2)}\n`,
  );
}

/** Every request, newest first. */
export function listRefundRequests(): RefundRecord[] {
  return read().reverse();
}

export function getRefundRequest(id: string): RefundRecord | undefined {
  return read().find((r) => r.id === id.trim().toUpperCase());
}

/**
 * Records a refund the rules allow: paid now ("refund"), or waiting for a
 * supervisor ("needs_approval"). Denials and warranty claims aren't refunds,
 * so they can't be submitted.
 */
export function createRefundRequest(
  request: RefundRequest,
  decision: RefundDecision,
): RefundRecord {
  if (decision.outcome !== "refund" && decision.outcome !== "needs_approval")
    throw new Error(`A ${decision.outcome} decision can't be submitted.`);
  const records = read();
  const record: RefundRecord = {
    ...request,
    id: `RF-${1001 + records.length}`,
    createdAt: new Date().toISOString(),
    amountUsd: decision.amountUsd,
    rule: decision.rule,
    source: decision.source,
    status: decision.outcome === "refund" ? "paid" : "pending",
  };
  write([...records, record]);
  return record;
}

/** A supervisor's decision on a pending request. */
export function decideRefundRequest(
  id: string,
  decision: "approved" | "denied",
): RefundRecord {
  const records = read();
  const record = records.find((r) => r.id === id);
  if (!record) throw new Error(`No refund request ${id}.`);
  if (record.status !== "pending")
    throw new Error(`${id} is already ${record.status}.`);
  Object.assign(record, {
    status: decision,
    decidedAt: new Date().toISOString(),
  });
  write(records);
  return record;
}
