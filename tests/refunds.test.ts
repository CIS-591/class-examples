// @vitest-environment node
import { describe, expect, it } from "vitest";
import { APPROVAL_LIMIT_USD, refundDecision } from "@/lib/copper/refunds";

// Each test is one rule from the Terms and Conditions (Sections 2, 3 and 4) or the Copper
// Plus Refund Exceptions Playbook (Product Bible Section 9).

describe("refundDecision: devices", () => {
  it("refunds a device returned within 30 days, for any reason", () => {
    const decision = refundDecision({
      item: "copper-notes",
      daysSincePurchase: 12,
      reason: "changed_mind",
    });
    expect(decision.amountUsd).toBe(129);
    expect(decision.source).toBe("Terms and Conditions, Section 2.1");
  });

  it("sends a refund over the approval limit to a person", () => {
    const decision = refundDecision({
      item: "copper-home",
      daysSincePurchase: 5,
      reason: "changed_mind",
    });
    expect(149).toBeGreaterThan(APPROVAL_LIMIT_USD);
    expect(decision).toMatchObject({
      outcome: "needs_approval",
      amountUsd: 149,
    });
  });

  it("counts day 30 as inside the return window", () => {
    expect(
      refundDecision({
        item: "copper-notes",
        daysSincePurchase: 30,
        reason: "changed_mind",
      }).amountUsd,
    ).toBe(129);
  });

  it("refuses a return after 30 days with no defect", () => {
    expect(
      refundDecision({
        item: "copper-home",
        daysSincePurchase: 31,
        reason: "changed_mind",
      }),
    ).toMatchObject({ outcome: "denied", amountUsd: 0 });
  });

  it("turns a defect after 30 days into a warranty claim, not a refund", () => {
    // Copper Home: 2-year warranty.
    expect(
      refundDecision({
        item: "copper-home",
        daysSincePurchase: 400,
        reason: "defect",
      }),
    ).toMatchObject({
      outcome: "warranty_claim",
      amountUsd: 0,
      source: "Terms and Conditions, Section 3",
    });
  });

  it("ends the Copper Notes warranty after 1 year", () => {
    expect(
      refundDecision({
        item: "copper-notes",
        daysSincePurchase: 400,
        reason: "defect",
      }).outcome,
    ).toBe("denied");
  });

  it("never covers heat damage from a vehicle after 30 days", () => {
    expect(
      refundDecision({
        item: "copper-notes",
        daysSincePurchase: 90,
        reason: "heat_damage",
      }).outcome,
    ).toBe("denied");
  });
});

describe("refundDecision: Copper Plus", () => {
  it("refunds an annual plan cancelled within 14 days, with no approval", () => {
    expect(
      refundDecision({
        item: "copper-plus-annual",
        daysSincePurchase: 10,
        reason: "changed_mind",
      }),
    ).toMatchObject({
      outcome: "refund",
      amountUsd: 79,
      source: "Terms and Conditions, Section 4.6",
    });
  });

  it("refuses an annual plan after 14 days", () => {
    expect(
      refundDecision({
        item: "copper-plus-annual",
        daysSincePurchase: 15,
        reason: "changed_mind",
      }).outcome,
    ).toBe("denied");
  });

  it("never refunds part of a monthly plan", () => {
    expect(
      refundDecision({
        item: "copper-plus-monthly",
        daysSincePurchase: 3,
        reason: "changed_mind",
      }),
    ).toMatchObject({ outcome: "denied", amountUsd: 0 });
  });

  it("sends an outage refund (up to 3 months) to a supervisor", () => {
    expect(
      refundDecision({
        item: "copper-plus-monthly",
        daysSincePurchase: 50,
        reason: "outage",
      }),
    ).toMatchObject({
      outcome: "needs_approval",
      amountUsd: 23.97,
      source: "Copper Crew supervisor review",
    });
  });
});
