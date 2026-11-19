"use client";

// The Refund Console's queue (Module 4): every refund the Refund Desk agent
// submitted. Refunds over the approval limit wait as "pending" until a Copper
// Crew supervisor (you) approves or denies them here: a person in the loop.
// Ask Copper announces each new request, so the list updates on its own.
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUsd, getPlans, getProducts } from "@/lib/copper/catalog";
import { decideRefund, getRefundQueue } from "@/lib/copper/refund-actions";
import type { RefundRecord, RefundStatus } from "@/lib/copper/refund-requests";

/** Ask Copper fires this on window after the Refund Desk submits a refund. */
export const REFUNDS_CHANGED = "copper:refunds-changed";

const ITEM_NAMES: Record<string, string> = {
  ...Object.fromEntries(getProducts().map((p) => [p.id, p.name])),
  "copper-plus-monthly": `${getPlans().find((p) => p.id === "copper-plus")!.name} (monthly)`,
  "copper-plus-annual": `${getPlans().find((p) => p.id === "copper-plus")!.name} (annual)`,
};

const REASONS: Record<string, string> = {
  changed_mind: "Changed mind",
  defect: "Defect",
  heat_damage: "Heat damage",
  outage: "Outage",
};

const STATUS: Record<RefundStatus, { label: string; className: string }> = {
  pending: { label: "Needs approval", className: "bg-chart-4 text-chart-5" },
  paid: { label: "Paid (under $100)", className: "bg-accent text-white" },
  approved: { label: "Approved", className: "bg-accent text-white" },
  denied: { label: "Denied", className: "bg-chart-3 text-white" },
};

export function RefundQueue({ initial }: { initial: RefundRecord[] }) {
  const [requests, setRequests] = useState(initial);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const reload = () =>
      startTransition(async () => setRequests(await getRefundQueue()));
    window.addEventListener(REFUNDS_CHANGED, reload);
    return () => window.removeEventListener(REFUNDS_CHANGED, reload);
  }, []);

  const decide = (id: string, decision: "approved" | "denied") =>
    startTransition(async () => setRequests(await decideRefund(id, decision)));

  const waiting = requests.filter((r) => r.status === "pending").length;

  return (
    <section data-testid="refund-queue" className="mt-6 space-y-3">
      <p className="text-muted-foreground text-sm">
        {waiting
          ? `${waiting} refund${waiting === 1 ? "" : "s"} waiting for a supervisor.`
          : "Nothing waiting for a supervisor."}{" "}
        Refunds over $100 wait here until you approve or deny them.
      </p>
      {requests.length === 0 ? (
        <p className="bg-card rounded-xl border p-6 text-center text-sm">
          No refund requests yet. Ask Copper for a refund in the chat, for
          example: &ldquo;I bought Copper Home 5 days ago and changed my mind.
          Can I get a refund?&rdquo;
        </p>
      ) : (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id} data-testid="refund-row">
                  <TableCell className="font-mono font-bold">{r.id}</TableCell>
                  <TableCell>
                    {ITEM_NAMES[r.item] ?? r.item}
                    <span className="text-muted-foreground block text-xs">
                      {r.daysSincePurchase} days ago
                    </span>
                  </TableCell>
                  <TableCell>{REASONS[r.reason] ?? r.reason}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatUsd(r.amountUsd)}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS[r.status].className}>
                      {STATUS[r.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    {r.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => decide(r.id, "approved")}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => decide(r.id, "denied")}
                        >
                          Deny
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
