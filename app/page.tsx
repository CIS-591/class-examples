import { AskCopper } from "@/components/copper/ask-copper";
import { Hero } from "@/components/copper/landing/hero";
import { PlusPricing } from "@/components/copper/landing/plus-pricing";
import { PrivacySummary } from "@/components/copper/landing/privacy-summary";
import { ProductsSection } from "@/components/copper/landing/products-section";
import { Showcase } from "@/components/copper/landing/showcase";
import { SiteFooter } from "@/components/copper/site-footer";
import { SiteHeader } from "@/components/copper/site-header";
import { isAiConfigured } from "@/lib/ai/call";
import { getPlans, getPrivacySummary, getProducts } from "@/lib/copper/catalog";

export default function Home() {
  const products = getProducts();
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero products={products} />
        <ProductsSection products={products} />
        <Showcase products={products} />
        <PlusPricing plans={getPlans()} />
        <PrivacySummary privacy={getPrivacySummary()} />
      </main>
      <SiteFooter />
      <AskCopper aiConfigured={isAiConfigured()} />
    </>
  );
}
