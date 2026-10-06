// 商品一覧の検索・絞り込み・並び替え（クライアントで即時に実行）
import { isSold, isStock } from "./constants";
import type { MasterData, Product, ProductStatus } from "./types";

export type StatusFilter = "all" | "stock" | "sold" | ProductStatus;

export type ProductFilters = {
  q: string;
  status: StatusFilter;
  categoryId: string;
  brandId: string;
  supplierId: string;
  storeId: string;
  platformId: string;
  minProfit: number | null;
  maxProfit: number | null;
  minMargin: number | null;
  maxMargin: number | null;
  purchaseFrom: string;
  purchaseTo: string;
  soldFrom: string;
  soldTo: string;
};

export const EMPTY_FILTERS: ProductFilters = {
  q: "",
  status: "all",
  categoryId: "",
  brandId: "",
  supplierId: "",
  storeId: "",
  platformId: "",
  minProfit: null,
  maxProfit: null,
  minMargin: null,
  maxMargin: null,
  purchaseFrom: "",
  purchaseTo: "",
  soldFrom: "",
  soldTo: "",
};

export const SORT_OPTIONS = {
  newest: "新しい順",
  oldest: "古い順",
  profit: "利益が高い順",
  margin: "利益率が高い順",
  purchase: "仕入価格が高い順",
  sale: "販売価格が高い順",
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

/** 詳細フィルター（ステータス・検索以外）の適用数 */
export function activeFilterCount(f: ProductFilters): number {
  const keys: (keyof ProductFilters)[] = [
    "categoryId",
    "brandId",
    "supplierId",
    "storeId",
    "platformId",
    "minProfit",
    "maxProfit",
    "minMargin",
    "maxMargin",
    "purchaseFrom",
    "purchaseTo",
    "soldFrom",
    "soldTo",
  ];
  return keys.filter((k) => f[k] !== "" && f[k] !== null).length;
}

const normalize = (s: string) => s.normalize("NFKC").toLowerCase();

/** 検索用インデックス（商品名・ブランド・店舗・仕入先・カテゴリ・メモ） */
export function buildSearchIndex(products: Product[], master: MasterData): Map<string, string> {
  const name = (list: { id: string; name: string }[], id: string | null) =>
    id ? (list.find((x) => x.id === id)?.name ?? "") : "";
  return new Map(
    products.map((p) => [
      p.id,
      normalize(
        [
          p.name,
          name(master.brands, p.brand_id),
          name(master.stores, p.purchase_store_id),
          name(master.suppliers, p.supplier_id),
          name(master.categories, p.category_id),
          p.memo ?? "",
        ].join(" "),
      ),
    ]),
  );
}

export function filterProducts(
  products: Product[],
  f: ProductFilters,
  index: Map<string, string>,
): Product[] {
  const terms = normalize(f.q).split(/\s+/).filter(Boolean);
  return products.filter((p) => {
    if (terms.length) {
      const hay = index.get(p.id) ?? "";
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    if (f.status === "stock" && !isStock(p.status)) return false;
    if (f.status === "sold" && !isSold(p.status)) return false;
    if (f.status !== "all" && f.status !== "stock" && f.status !== "sold" && p.status !== f.status) return false;
    if (f.categoryId && p.category_id !== f.categoryId) return false;
    if (f.brandId && p.brand_id !== f.brandId) return false;
    if (f.supplierId && p.supplier_id !== f.supplierId) return false;
    if (f.storeId && p.purchase_store_id !== f.storeId) return false;
    if (f.platformId && p.selling_platform_id !== f.platformId) return false;
    if (f.minProfit !== null && (p.profit ?? -Infinity) < f.minProfit) return false;
    if (f.maxProfit !== null && (p.profit ?? Infinity) > f.maxProfit) return false;
    if (f.minMargin !== null && (p.profit_margin ?? -Infinity) < f.minMargin) return false;
    if (f.maxMargin !== null && (p.profit_margin ?? Infinity) > f.maxMargin) return false;
    if (f.purchaseFrom && p.purchase_date < f.purchaseFrom) return false;
    if (f.purchaseTo && p.purchase_date > f.purchaseTo) return false;
    if (f.soldFrom && (!p.sold_date || p.sold_date < f.soldFrom)) return false;
    if (f.soldTo && (!p.sold_date || p.sold_date > f.soldTo)) return false;
    return true;
  });
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const sale = (p: Product) => p.actual_sale_price ?? p.expected_sale_price ?? -1;
  const byDate = (a: Product, b: Product) =>
    a.purchase_date === b.purchase_date
      ? a.created_at.localeCompare(b.created_at)
      : a.purchase_date.localeCompare(b.purchase_date);
  const list = [...products];
  switch (sort) {
    case "newest":
      return list.sort((a, b) => byDate(b, a));
    case "oldest":
      return list.sort(byDate);
    case "profit":
      return list.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
    case "margin":
      return list.sort((a, b) => (b.profit_margin ?? -Infinity) - (a.profit_margin ?? -Infinity));
    case "purchase":
      return list.sort((a, b) => b.purchase_price - a.purchase_price);
    case "sale":
      return list.sort((a, b) => sale(b) - sale(a));
  }
}
