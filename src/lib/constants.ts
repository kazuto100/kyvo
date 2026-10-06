import type { ProductStatus } from "./types";

export const STATUS_META: Record<
  ProductStatus,
  { label: string; tone: "neutral" | "blue" | "amber" | "green" | "violet" | "red" | "gray" }
> = {
  purchased: { label: "仕入れ済み", tone: "neutral" },
  preparing: { label: "出品準備中", tone: "amber" },
  listed: { label: "出品中", tone: "blue" },
  sold: { label: "売却済み", tone: "green" },
  shipped: { label: "発送済み", tone: "violet" },
  returned: { label: "返品", tone: "red" },
  on_hold: { label: "保留", tone: "gray" },
};

/** 売上計上するステータス */
export const SOLD_STATUSES: ProductStatus[] = ["sold", "shipped"];

/** 在庫として扱うステータス */
export const STOCK_STATUSES: ProductStatus[] = [
  "purchased",
  "preparing",
  "listed",
  "returned",
  "on_hold",
];

export const isSold = (s: ProductStatus) => SOLD_STATUSES.includes(s);
export const isStock = (s: ProductStatus) => STOCK_STATUSES.includes(s);

export const CONDITIONS = [
  "新品・未使用",
  "未使用に近い",
  "目立った傷や汚れなし",
  "やや傷や汚れあり",
  "傷や汚れあり",
  "全体的に状態が悪い",
  "ジャンク",
] as const;

export const EXPENSE_CATEGORIES = [
  "梱包資材",
  "交通費",
  "ガソリン代",
  "駐車場",
  "ツール・サブスク",
  "事務用品",
  "その他",
] as const;
