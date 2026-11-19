"use client";

// The Refund Console (Module 4): the auto-refund limit, the refunds waiting
// for a person, and the customer's orders, with Ask Copper docked beside it.
// The chat sends the limit and the refunds so far with each message; the app
// decides each refund against the limit; refunds over it wait here until you
// approve or reject them, and the Refund agent then tells the customer.
// Everything lives in this page's state, so a reload starts fresh.
import { useState } from "react";
import { AskCopper } from "@/components/copper/ask-copper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsd } from "@/lib/copper/catalog";
import {
  CUSTOMER,
  DEFAULT_LIMIT_USD,
  getOrders,
  type Refund,
  type RefundResult,
} from "@/lib/copper/orders";

const ORDERS = getOrders();

const STARTERS = [
  "I'd like a refund for my Copper Plus monthly plan.",
  "I want my money back for my Copper Home.",
  "What does the refund policy say about annual plans?",
];

const STATUS: Record<string, { label: string; className: string }> = {
  "refunded-auto": {
    label: "Refunded automatically",
    className: "bg-accent text-white",
  },
  "refunded-supervisor": {
    label: "Refunded, approved by you",
    className: "bg-accent text-white",
  },
  "waiting-auto": {
    label: "Waiting for approval",
    className: "bg-chart-3 text-white",
  },
  "rejected-supervisor": {
    label: "Rejected by you",
    className: "bg-muted-foreground text-white",
  },
};

export function RefundConsole({ aiConfigured }: { aiConfigured: boolean }) {
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT_USD));
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);
  const limitUsd = Math.max(0, Number(limit) || 0);
  const waiting = refunds.filter((r) => r.status === "waiting");

  /** The app's decision on a refund, from the chat. */
  function onDecision(result: RefundResult) {
    if (result.status !== "refunded" && result.status !== "needs_approval")
      return;
    const { orderId, item, amountUsd } = result;
    const status = result.status === "refunded" ? "refunded" : "waiting";
    setRefunds((all) =>
      all.some((r) => r.orderId === orderId)
        ? all
        : [...all, { orderId, item, amountUsd, status, by: "auto" }],
    );
  }

  /** Your decision on a waiting refund. The chat tells the Refund agent. */
  function decide(refund: Refund, approve: boolean) {
    if (!refunds.some((r) => r === refund && r.status === "waiting")) return;
    setRefunds((all) =>
      all.map((r) =>
        r === refund
          ? {
              ...r,
              status: approve ? "refunded" : "rejected",
              by: "supervisor",
            }
          : r,
      ),
    );
    setNote((last) => ({
      id: (last?.id ?? 0) + 1,
      text: `[Refund Console] A supervisor ${approve ? "approved" : "rejected"} the ${formatUsd(refund.amountUsd)} refund for order #${refund.orderId} (${refund.item}).${approve ? " It has been refunded." : " It will not be refunded."}`,
    }));
  }

  return (
    <>
      <main
        data-testid="refund-console"
        className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8"
      >
        <div>
          <h1 className="font-display text-3xl font-bold">Refund Console</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Ask for a refund in the chat as the customer. Copper hands you to
            the Refund agent, which asks the app for the refund. The app checks
            the amount against your limit: at or under it, the refund goes
            through; over it, it waits here for you.
          </p>
        </div>

        <section className="bg-card space-y-2 rounded-xl border p-4">
          <Label htmlFor="refund-limit" className="font-semibold">
            Auto-refund limit
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <Input
              id="refund-limit"
              type="number"
              min={0}
              step={1}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="w-32"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Refunds up to {formatUsd(limitUsd)} go through on their own.
            Anything larger needs your approval.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">Waiting for your approval</h2>
          {waiting.length === 0 && (
            <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
              Nothing is waiting. Refunds over the limit will stop here.
            </p>
          )}
          {waiting.map((refund) => (
            <div
              key={refund.orderId}
              data-testid="waiting-refund"
              className="border-chart-3 bg-card flex flex-wrap items-center gap-3 rounded-xl border-2 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  #{refund.orderId} {refund.item}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatUsd(refund.amountUsd)} is over the{" "}
                  {formatUsd(limitUsd)} limit. The Refund agent is paused.
                </p>
              </div>
              <span className="font-mono text-lg font-bold">
                {formatUsd(refund.amountUsd)}
              </span>
              <Button onClick={() => decide(refund, true)}>Approve</Button>
              <Button variant="outline" onClick={() => decide(refund, false)}>
                Reject
              </Button>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold">{CUSTOMER}&apos;s orders</h2>
          <ul className="bg-card divide-y rounded-xl border text-sm">
            {ORDERS.map((order) => {
              const refund = refunds.find((r) => r.orderId === order.id);
              const status = refund && STATUS[`${refund.status}-${refund.by}`];
              return (
                <li
                  key={order.id}
                  data-testid="order"
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="text-muted-foreground font-mono">
                    #{order.id}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">
                    {order.item}
                  </span>
                  {status ? (
                    <Badge className={status.className}>{status.label}</Badge>
                  ) : (
                    <Badge variant="outline">Paid</Badge>
                  )}
                  <span className="w-16 text-right font-mono">
                    {formatUsd(order.amountUsd)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
      <AskCopper
        aiConfigured={aiConfigured}
        docked
        support={{
          desk: { limitUsd, refunds },
          onDecision,
          note,
          starters: STARTERS,
        }}
      />
    </>
  );
}
