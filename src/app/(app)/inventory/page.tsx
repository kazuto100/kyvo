import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { InventoryView } from "@/components/inventory/inventory-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inventorySummary } from "@/lib/analytics";
import { getMasterData, getProducts, signImagePaths } from "@/lib/data";
import { formatNumber, formatYen, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "在庫" };

export default async function InventoryPage() {
  const [master, products] = await Promise.all([getMasterData(), getProducts()]);
  const today = todayISO();
  const inv = inventorySummary(products, today, master.profile);
  const images = await signImagePaths(inv.stock.map((p) => p.image_urls[0]).filter(Boolean));
  const maxBucket = Math.max(1, ...inv.aging.map((b) => b.count));

  return (
    <div className="space-y-4">
      <PageHeader title="在庫" description="まだ売れていない商品と在庫期間" back="/" />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label="現在在庫" value={`${formatNumber(inv.count)}商品`} />
        <Tile label="仕入れ原価" value={formatYen(inv.cost)} />
        <Tile label="想定売上" value={formatYen(inv.expectedSales)} sub={inv.noPriceCount > 0 ? `価格未設定 ${inv.noPriceCount}件` : undefined} />
        <Tile label="想定利益" value={formatYen(inv.expectedProfit)} accent />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>在庫期間</CardTitle>
          <span className="text-xs text-muted-foreground">
            ⚠️{master.profile.stock_alert_days_warning}日 · 🔴{master.profile.stock_alert_days_markdown}日 · 🚨{master.profile.stock_alert_days_dispose}日
          </span>
        </CardHeader>
        <CardContent className="space-y-2">
          {inv.aging.map((b) => (
            <div key={b.label} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-muted-foreground">{b.label}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-secondary">
                <div
                  className={b.max > 60 ? "h-full rounded-md bg-loss" : b.max > 30 ? "h-full rounded-md bg-warn" : "h-full rounded-md bg-brand"}
                  style={{ width: `${(b.count / maxBucket) * 100}%`, minWidth: b.count ? 6 : 0 }}
                />
              </div>
              <span className="num w-28 shrink-0 text-right">
                {b.count}件 <span className="text-xs text-muted-foreground">{formatYen(b.cost)}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <InventoryView stock={inv.stock} master={master} images={images} today={today} />
    </div>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={accent ? "num mt-1 text-xl font-bold text-profit" : "num mt-1 text-xl font-bold"}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
