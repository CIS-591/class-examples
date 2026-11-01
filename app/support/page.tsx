import type { Metadata } from "next";
import { SiteFooter } from "@/components/copper/site-footer";
import { SiteHeader } from "@/components/copper/site-header";

export const metadata: Metadata = {
  title: "Support · Copper State Labs",
  description: "Help with Copper Home and Copper Notes.",
};

// Module 3 builds the Copper Crew Support experience on this page.
export default function SupportPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="font-heading text-4xl font-extrabold sm:text-5xl">
            Support
          </h1>
          <p className="text-muted-foreground mt-4 text-lg">Coming soon.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
