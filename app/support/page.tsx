import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AskCopper } from "@/components/copper/ask-copper";
import { RefundQueue } from "@/components/copper/refund-queue";
import { SiteHeader } from "@/components/copper/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { isAiConfigured } from "@/lib/ai/call";
import { listRefundRequests } from "@/lib/copper/refund-requests";

export const metadata: Metadata = { title: "Support | Copper State Labs" };

export default function Support() {
  return (
    // Leaves room on the right for the docked chat.
    <div className="flex flex-1 flex-col lg:pr-[28rem]">
      <SiteHeader />
      <main
        data-testid="refund-console"
        className="mx-auto w-full max-w-3xl flex-1 px-4 py-8"
      >
        <h1 className="font-display text-3xl font-bold">Refund Console</h1>
        {/* Module 4: the refunds the Refund Desk agent submitted. */}
        <Suspense fallback={<Skeleton className="mt-6 h-40 w-full" />}>
          <Requests />
        </Suspense>
      </main>
      <AskCopper aiConfigured={isAiConfigured()} docked />
    </div>
  );
}

/** Read on every request: the list changes as refunds come in. */
async function Requests() {
  await connection();
  return <RefundQueue initial={listRefundRequests()} />;
}
