"use server";

// The Refund Console's server actions (Module 4): read the refund requests,
// and a supervisor's Approve or Deny on a pending one.
import {
  decideRefundRequest,
  listRefundRequests,
  type RefundRecord,
} from "@/lib/copper/refund-requests";

export async function getRefundQueue(): Promise<RefundRecord[]> {
  return listRefundRequests();
}

export async function decideRefund(
  id: string,
  decision: "approved" | "denied",
): Promise<RefundRecord[]> {
  decideRefundRequest(id, decision);
  return listRefundRequests();
}
