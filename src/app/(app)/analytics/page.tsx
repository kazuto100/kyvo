import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { PageHeader } from "@/components/app/page-header";
import { getExpenses, getMasterData, getProducts } from "@/lib/data";
import { currentMonthKey } from "@/lib/format";

export const metadata: Metadata = { title: "分析" };

export default async function AnalyticsPage() {
  const [master, products, expenses] = await Promise.all([getMasterData(), getProducts(), getExpenses()]);
  return (
    <div>
      <PageHeader title="分析" description="どこで仕入れ、何を売ると儲かるのか" showSettings />
      <AnalyticsView products={products} expenses={expenses} master={master} currentMonth={currentMonthKey()} />
    </div>
  );
}
