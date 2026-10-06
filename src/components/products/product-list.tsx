"use client";

import { Download, LayoutList, Package, Search, SlidersHorizontal, Table2, X, Zap } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState, useSyncExternalStore } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { Money, Percent } from "@/components/app/money";
import { StatusBadge } from "@/components/app/status-badge";
import { YenInput } from "@/components/app/yen-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { STATUS_META } from "@/lib/constants";
import { downloadText, productsToCSV } from "@/lib/csv";
import { formatShortDate, formatYen } from "@/lib/format";
import {
  activeFilterCount,
  buildSearchIndex,
  EMPTY_FILTERS,
  filterProducts,
  SORT_OPTIONS,
  sortProducts,
  type ProductFilters,
  type SortKey,
  type StatusFilter,
} from "@/lib/product-filter";
import { PRODUCT_STATUSES, type MasterData, type Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProductRow, ProductThumb } from "./product-row";

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "stock", label: "在庫" },
  { key: "listed", label: "出品中" },
  { key: "sold", label: "売却済み" },
  { key: "preparing", label: "出品準備中" },
  { key: "purchased", label: "仕入れ済み" },
  { key: "on_hold", label: "保留" },
  { key: "returned", label: "返品" },
];

const VIEW_KEY = "resell:products:view";
const VIEW_EVENT = "resell:view-change";

// 表示モード（カード/テーブル）はブラウザごとに記憶する
function readView(): "card" | "table" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "table" ? "table" : "card";
  } catch {
    return "card";
  }
}
function subscribeView(cb: () => void) {
  window.addEventListener(VIEW_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(VIEW_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function ProductList({
  products,
  master,
  images,
  today,
  initialStatus,
}: {
  products: Product[];
  master: MasterData;
  images: Record<string, string>;
  today: string;
  initialStatus?: StatusFilter;
}) {
  const [filters, setFilters] = useState<ProductFilters>({ ...EMPTY_FILTERS, status: initialStatus ?? "all" });
  const [sort, setSort] = useState<SortKey>("newest");
  const view = useSyncExternalStore(subscribeView, readView, () => "card" as const);
  const [filterOpen, setFilterOpen] = useState(false);
  const deferredQ = useDeferredValue(filters.q);

  const index = useMemo(() => buildSearchIndex(products, master), [products, master]);
  const result = useMemo(
    () => sortProducts(filterProducts(products, { ...filters, q: deferredQ }, index), sort),
    [products, filters, deferredQ, index, sort],
  );
  const totals = useMemo(
    () => ({
      profit: result.reduce((s, p) => s + (p.profit ?? 0), 0),
      cost: result.reduce((s, p) => s + p.purchase_price + p.other_purchase_cost, 0),
    }),
    [result],
  );
  const advancedCount = activeFilterCount(filters);
  const brandName = (id: string | null) => master.brands.find((b) => b.id === id)?.name;

  function changeView(v: "card" | "table") {
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* noop */
    }
    window.dispatchEvent(new Event(VIEW_EVENT));
  }

  function exportCSV() {
    downloadText(`products_${today}.csv`, productsToCSV(result, master));
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="商品がまだありません"
        description="仕入れた商品を登録して、利益と在庫を管理しましょう。"
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="brand" size="lg" asChild>
              <Link href="/products/quick">
                <Zap />
                クイック仕入れ
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/products/new">詳細登録</Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="商品名・ブランド・店舗・カテゴリで検索"
            className="h-11 pl-10"
            enterKeyHint="search"
          />
        </div>
        <Button
          variant="outline"
          className="relative h-11 w-11 px-0"
          onClick={() => setFilterOpen(true)}
          aria-label="絞り込み"
        >
          <SlidersHorizontal />
          {advancedCount > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
              {advancedCount}
            </span>
          )}
        </Button>
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        {STATUS_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilters((f) => ({ ...f, status: c.key }))}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3.5 text-[13px] font-medium transition",
              filters.status === c.key ? "border-primary bg-primary text-primary-foreground" : "bg-surface text-muted-foreground hover:bg-accent",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="num text-xs text-muted-foreground">
          {result.length}件 · 利益計 <Money value={totals.profit} tone="auto" className="font-semibold" /> · 原価計 {formatYen(totals.cost)}
        </p>
        <div className="flex items-center gap-1">
          <NativeSelect
            aria-label="並び替え"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="[&_select]:h-9 [&_select]:rounded-lg [&_select]:text-sm"
          >
            {Object.entries(SORT_OPTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <div className="hidden rounded-lg border p-0.5 sm:flex">
            <Button variant={view === "card" ? "secondary" : "ghost"} size="icon-sm" onClick={() => changeView("card")} aria-label="カード表示">
              <LayoutList />
            </Button>
            <Button variant={view === "table" ? "secondary" : "ghost"} size="icon-sm" onClick={() => changeView("table")} aria-label="テーブル表示">
              <Table2 />
            </Button>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={exportCSV} aria-label="CSVエクスポート" title="表示中の商品をCSVで書き出し">
            <Download />
          </Button>
        </div>
      </div>

      {result.length === 0 ? (
        <EmptyState
          icon={Search}
          title="条件に合う商品がありません"
          action={
            <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              <X />
              条件をクリア
            </Button>
          }
        />
      ) : view === "table" ? (
        <ProductTable products={result} images={images} />
      ) : (
        <div className="grid gap-2 lg:grid-cols-2">
          {result.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              imageUrl={images[p.image_urls[0]]}
              brandName={brandName(p.brand_id)}
              today={today}
              thresholds={master.profile}
            />
          ))}
        </div>
      )}

      <FilterDialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onApply={setFilters}
        master={master}
      />
    </div>
  );
}

function ProductTable({ products, images }: { products: Product[]; images: Record<string, string> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="border-b bg-secondary/50 text-xs text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:font-medium">
            <th className="w-14" />
            <th className="text-left">商品名</th>
            <th className="text-right">仕入価格</th>
            <th className="text-right">販売価格</th>
            <th className="text-right">利益</th>
            <th className="text-right">利益率</th>
            <th className="text-left">ステータス</th>
            <th className="text-right">仕入日</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="relative border-b last:border-0 hover:bg-accent/40 [&>td]:px-3 [&>td]:py-2">
              <td>
                <ProductThumb url={images[p.image_urls[0]]} className="size-10 rounded-lg" />
              </td>
              <td className="max-w-64">
                <Link href={`/products/${p.id}`} className="line-clamp-2 font-medium after:absolute after:inset-0">
                  {p.name}
                </Link>
              </td>
              <td className="num text-right">{formatYen(p.purchase_price)}</td>
              <td className="num text-right">{formatYen(p.actual_sale_price ?? p.expected_sale_price)}</td>
              <td className="text-right">
                <Money value={p.profit} tone="auto" className="font-semibold" />
              </td>
              <td className="text-right">
                <Percent value={p.profit_margin} />
              </td>
              <td>
                <StatusBadge status={p.status} />
              </td>
              <td className="num text-right text-muted-foreground">{formatShortDate(p.purchase_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterDialog({
  open,
  onOpenChange,
  filters,
  onApply,
  master,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: ProductFilters;
  onApply: (f: ProductFilters) => void;
  master: MasterData;
}) {
  const [draft, setDraft] = useState(filters);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(filters);
  }
  const set = <K extends keyof ProductFilters>(k: K, v: ProductFilters[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const select = (
    label: string,
    key: "categoryId" | "brandId" | "supplierId" | "storeId" | "platformId",
    list: { id: string; name: string }[],
  ) => (
    <Field label={label}>
      <NativeSelect value={draft[key]} onChange={(e) => set(key, e.target.value)}>
        <option value="">すべて</option>
        {list.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>絞り込み</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="ステータス">
            <NativeSelect value={draft.status} onChange={(e) => set("status", e.target.value as StatusFilter)}>
              <option value="all">すべて</option>
              <option value="stock">在庫（未売却）</option>
              <option value="sold">売却済み＋発送済み</option>
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {select("カテゴリ", "categoryId", master.categories)}
            {select("ブランド", "brandId", master.brands)}
            {select("仕入先", "supplierId", master.suppliers)}
            {select("仕入店舗", "storeId", master.stores)}
            {select("販売先", "platformId", master.platforms)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="利益（以上）">
              <YenInput value={draft.minProfit} onChange={(v) => set("minProfit", v)} placeholder="下限" />
            </Field>
            <Field label="利益（以下）">
              <YenInput value={draft.maxProfit} onChange={(v) => set("maxProfit", v)} placeholder="上限" />
            </Field>
            <Field label="利益率（以上）">
              <YenInput value={draft.minMargin} onChange={(v) => set("minMargin", v)} prefix={null} suffix="%" placeholder="下限" />
            </Field>
            <Field label="利益率（以下）">
              <YenInput value={draft.maxMargin} onChange={(v) => set("maxMargin", v)} prefix={null} suffix="%" placeholder="上限" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="仕入日（から）">
              <Input type="date" value={draft.purchaseFrom} onChange={(e) => set("purchaseFrom", e.target.value)} />
            </Field>
            <Field label="仕入日（まで）">
              <Input type="date" value={draft.purchaseTo} onChange={(e) => set("purchaseTo", e.target.value)} />
            </Field>
            <Field label="販売日（から）">
              <Input type="date" value={draft.soldFrom} onChange={(e) => set("soldFrom", e.target.value)} />
            </Field>
            <Field label="販売日（まで）">
              <Input type="date" value={draft.soldTo} onChange={(e) => set("soldTo", e.target.value)} />
            </Field>
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" size="lg" onClick={() => setDraft({ ...EMPTY_FILTERS, q: filters.q })}>
            クリア
          </Button>
          <Button
            size="lg"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            適用する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
