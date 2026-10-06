"use client";

import { Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSignedImageUrls } from "@/hooks/use-signed-image-urls";
import { EmptyState } from "@/components/app/empty-state";
import { ProductRow } from "@/components/products/product-row";
import { stockAlertLevel, stockDays, type StockAlertLevel } from "@/lib/analytics";
import type { MasterData, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 60;

const FILTERS: { key: "all" | Exclude<StockAlertLevel, "none">; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "warning", label: "⚠️ 経過" },
  { key: "markdown", label: "🔴 値下げ検討" },
  { key: "dispose", label: "🚨 処分・再出品" },
];

export function InventoryView({
  stock,
  master,
  today,
}: {
  stock: Product[];
  master: MasterData;
  today: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const list = useMemo(
    () =>
      stock
        .map((p) => ({ p, days: stockDays(p, today) }))
        .filter(({ days }) => filter === "all" || stockAlertLevel(days, master.profile) === filter)
        .sort((a, b) => b.days - a.days),
    [stock, today, filter, master.profile],
  );
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [prevList, setPrevList] = useState(list);
  if (prevList !== list) {
    setPrevList(list);
    setLimit(PAGE_SIZE);
  }
  const visible = list.slice(0, limit);
  const images = useSignedImageUrls(visible.map(({ p }) => p.image_urls[0]).filter(Boolean));
  const brands = useMemo(() => new Map(master.brands.map((b) => [b.id, b.name])), [master.brands]);
  const brandName = (id: string | null) => (id ? brands.get(id) : undefined);

  if (stock.length === 0) {
    return <EmptyState icon={Warehouse} title="在庫はありません" description="すべて売り切れています。次の仕入れへ！" />;
  }

  return (
    <div className="space-y-3">
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition",
              filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">該当する在庫はありません</p>
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {visible.map(({ p }) => (
            <ProductRow key={p.id} product={p} imageUrl={images[p.image_urls[0]]} brandName={brandName(p.brand_id)} today={today} thresholds={master.profile} />
          ))}
        </div>
      )}
      {list.length > visible.length && (
        <Button variant="outline" size="lg" className="w-full" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          さらに表示（残り{list.length - visible.length}件）
        </Button>
      )}
    </div>
  );
}
