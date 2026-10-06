import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { PurchaseCalculator } from "@/components/purchase/purchase-calculator";
import { soldProducts } from "@/lib/analytics";
import { getMasterData, getProducts } from "@/lib/data";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "仕入れ判断" };

export default async function SimulatorPage() {
  const [master, products] = await Promise.all([getMasterData(), getProducts()]);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="仕入れ判断" description="店舗で見つけた瞬間に、買うべきか・いくらまで出せるかを判定" showSettings />
      <PurchaseCalculator mode="simulator" master={master} today={todayISO()} history={soldProducts(products)} />
    </div>
  );
}
