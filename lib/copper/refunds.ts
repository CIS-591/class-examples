// Copper State Labs' refund rules (Module 4), as plain code: no AI. The same
// request always gets the same answer, so tests/refunds.test.ts can pin every
// rule down. The Refund Desk agent calls it through check_refund and
// submit_refund, so the model never decides a refund or its amount.
// Rules: Terms and Conditions Sections 2 (returns), 3 (warranty) and 4.6
// (Copper Plus refunds), plus the supervisors' Refund Exceptions Playbook
// (Product Bible Section 9). Prices come from the catalog.
import { getPlans, getProducts, type ProductId } from "@/lib/copper/catalog";

export type RefundItem =
  ProductId | "copper-plus-monthly" | "copper-plus-annual";

export type RefundReason = "changed_mind" | "defect" | "heat_damage" | "outage";

export type RefundRequest = {
  item: RefundItem;
  daysSincePurchase: number;
  reason: RefundReason;
};

export type RefundDecision = {
  /** refund: pay it now. needs_approval: a person decides. */
  outcome: "refund" | "needs_approval" | "warranty_claim" | "denied";
  amountUsd: number;
  /** The rule, in a sentence Copper can pass on. */
  rule: string;
  source: string;
};

/** Refunds above this go to a person before they're paid. */
export const APPROVAL_LIMIT_USD = 100;

const RETURN_DAYS = 30;
const ANNUAL_REFUND_DAYS = 14;
const WARRANTY_DAYS: Record<ProductId, number> = {
  "copper-home": 2 * 365,
  "copper-notes": 365,
};
/** Supervisors may refund up to this many months after an outage or bug. */
const OUTAGE_MONTHS = 3;

const cents = (usd: number) => Math.round(usd * 100) / 100;

/** A refund, sent to a person first when it's over the approval limit. */
function refund(
  amountUsd: number,
  rule: string,
  source: string,
): RefundDecision {
  return {
    outcome: amountUsd > APPROVAL_LIMIT_USD ? "needs_approval" : "refund",
    amountUsd,
    rule,
    source,
  };
}

const denied = (rule: string, source: string): RefundDecision => ({
  outcome: "denied",
  amountUsd: 0,
  rule,
  source,
});

function deviceDecision(
  id: ProductId,
  { daysSincePurchase, reason }: RefundRequest,
) {
  const product = getProducts().find((p) => p.id === id)!;
  if (daysSincePurchase <= RETURN_DAYS) {
    return refund(
      product.priceUsd,
      `${product.name} can be returned within ${RETURN_DAYS} days, for any reason.`,
      "Terms and Conditions, Section 2.1",
    );
  }
  if (reason === "heat_damage") {
    return denied(
      "The warranty doesn't cover heat damage from leaving a device in a vehicle.",
      "Terms and Conditions, Section 3",
    );
  }
  if (reason === "defect" && daysSincePurchase <= WARRANTY_DAYS[id]) {
    return {
      outcome: "warranty_claim",
      amountUsd: 0,
      rule: `${product.name} is under warranty, so we repair or replace it.`,
      source: "Terms and Conditions, Section 3",
    } satisfies RefundDecision;
  }
  return denied(
    `After ${RETURN_DAYS} days a device can't be returned, and this isn't a warranty defect.`,
    "Terms and Conditions, Section 2.5",
  );
}

function plusDecision(
  billing: "monthly" | "annual",
  { daysSincePurchase, reason }: RefundRequest,
) {
  const plus = getPlans().find((p) => p.id === "copper-plus")!;
  if (reason === "outage") {
    return {
      outcome: "needs_approval",
      amountUsd: cents(plus.monthlyUsd * OUTAGE_MONTHS),
      rule: "A supervisor reviews refunds for a confirmed outage or bug.",
      // Customers see the source, so it never names the supervisors-only playbook.
      source: "Copper Crew supervisor review",
    } satisfies RefundDecision;
  }
  if (billing === "annual" && daysSincePurchase <= ANNUAL_REFUND_DAYS) {
    return refund(
      plus.annualUsd,
      `Annual Copper Plus gets a full refund within ${ANNUAL_REFUND_DAYS} days.`,
      "Terms and Conditions, Section 4.6",
    );
  }
  return denied(
    billing === "monthly"
      ? "Monthly Copper Plus isn't refunded for partial months."
      : `Annual Copper Plus isn't refunded after ${ANNUAL_REFUND_DAYS} days.`,
    "Terms and Conditions, Section 4.6",
  );
}

/** check_refund: what Copper State Labs' rules say about one refund request. */
export function refundDecision(request: RefundRequest): RefundDecision {
  switch (request.item) {
    case "copper-plus-monthly":
      return plusDecision("monthly", request);
    case "copper-plus-annual":
      return plusDecision("annual", request);
    default:
      return deviceDecision(request.item, request);
  }
}
