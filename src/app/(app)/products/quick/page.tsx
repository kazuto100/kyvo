import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { EntryModeTabs } from "@/components/products/entry-mode-tabs";
import { PurchaseCalculator } from "@/components/purchase/purchase-calculator";
import { getMasterData } from "@/lib/data";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "クイック仕入れ" };

export default async function QuickPurchasePage() {
  const master = await getMasterData();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="クイック仕入れ" description="5項目だけで登録。詳細はあとから編集できます。" back="/" />
      <EntryModeTabs active="quick" />
      <PurchaseCalculator mode="quick" master={master} today={todayISO()} />
    </div>
  );
}
