// The customer's orders and the refund rule (Module 4). The rule is code, not
// the model: the app compares the order amount with the auto-refund limit. At
// or under it, the refund goes through; over it, it waits for a person on the
// Refund Console. The model can't argue past it.
// The Refund Console keeps the limit and every refund so far in the browser
// and sends them with each chat message (the "desk"), so nothing is stored on
// the server.
import data from "@/lib/copper/data/orders.json";

export type Order = (typeof data.orders)[number];

/** A refund the app decided ("auto") or a supervisor decided. */
export type Refund = {
  orderId: string;
  item: string;
  amountUsd: number;
  status: "refunded" | "waiting" | "rejected";
  by: "auto" | "supervisor";
};

/** What the Refund Console sends with each chat message. */
export type Desk = { limitUsd: number; refunds: Refund[] };

export const CUSTOMER = data.customer;

/** The starting auto-refund limit on the Refund Console. */
export const DEFAULT_LIMIT_USD = 50;

export function getOrders(): Order[] {
  return structuredClone(data.orders);
}

/** get_orders: the customer's orders, each with its refund so far. */
export function ordersWithRefunds(desk: Desk) {
  return {
    customer: CUSTOMER,
    orders: getOrders().map((order) => ({
      id: order.id,
      item: order.item,
      amountUsd: order.amountUsd,
      date: order.date,
      refund:
        desk.refunds.find((r) => r.orderId === order.id)?.status ?? "none",
    })),
  };
}

export type RefundResult =
  | { status: "not_found"; orderId: string }
  | {
      /** Already refunded, waiting or rejected: nothing new happens. */
      status: Refund["status"];
      orderId: string;
      item: string;
      amountUsd: number;
    }
  | {
      /** refunded: paid now. needs_approval: waits for a supervisor. */
      status: "refunded" | "needs_approval";
      orderId: string;
      item: string;
      amountUsd: number;
      limitUsd: number;
    };

/** request_refund: the app's decision. At or under the limit, it's refunded. */
export function requestRefund(orderId: string, desk: Desk): RefundResult {
  const id = orderId.replace(/^#/, "").trim();
  const order = getOrders().find((o) => o.id === id);
  if (!order) return { status: "not_found", orderId: id };
  const { item, amountUsd } = order;
  const earlier = desk.refunds.find((r) => r.orderId === id);
  if (earlier) return { status: earlier.status, orderId: id, item, amountUsd };
  return {
    status: amountUsd <= desk.limitUsd ? "refunded" : "needs_approval",
    orderId: id,
    item,
    amountUsd,
    limitUsd: desk.limitUsd,
  };
}
