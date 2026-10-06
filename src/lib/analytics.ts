// 集計ロジック（ダッシュボード・分析・在庫で共通利用）
import { isSold, isStock } from "./constants";
import { daysBetween, monthKey } from "./format";
import { calcRemainingUnits } from "./profit";
import type { Expense, Product, Profile } from "./types";

export type SoldSummary = {
  sales: number;
  costOfGoods: number;
  shipping: number;
  fees: number;
  /** 商品のその他経費 + 一般経費 */
  otherCosts: number;
  generalExpenses: number;
  profit: number;
  /** 利益 ÷ 売上 × 100 */
  margin: number | null;
  count: number;
  avgProfit: number;
  /** 商品ごとの利益率の平均 */
  avgMargin: number | null;
};

const salePriceOf = (p: Product) => p.actual_sale_price ?? p.expected_sale_price ?? 0;

export function soldProducts(products: Product[]): Product[] {
  return products.filter((p) => isSold(p.status) && p.sold_date);
}

export function summarizeSold(products: Product[], expenses: Expense[] = []): SoldSummary {
  let sales = 0;
  let costOfGoods = 0;
  let shipping = 0;
  let fees = 0;
  let productOther = 0;
  let productProfit = 0;
  let marginSum = 0;
  let marginCount = 0;
  for (const p of products) {
    const price = salePriceOf(p);
    sales += price;
    costOfGoods += p.purchase_price + p.other_purchase_cost;
    shipping += p.shipping_cost;
    fees += p.selling_fee;
    productOther += p.other_cost;
    productProfit += p.profit ?? 0;
    if (p.profit_margin !== null && price > 0) {
      marginSum += Number(p.profit_margin);
      marginCount++;
    }
  }
  const generalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const profit = productProfit - generalExpenses;
  const count = products.length;
  return {
    sales,
    costOfGoods,
    shipping,
    fees,
    otherCosts: productOther + generalExpenses,
    generalExpenses,
    profit,
    margin: sales > 0 ? (profit * 100) / sales : null,
    count,
    avgProfit: count > 0 ? productProfit / count : 0,
    avgMargin: marginCount > 0 ? marginSum / marginCount : null,
  };
}

export function soldInMonth(products: Product[], month: string): Product[] {
  return soldProducts(products).filter((p) => monthKey(p.sold_date!) === month);
}

export function expensesInMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter((e) => monthKey(e.expense_date) === month);
}

export function monthlySummary(products: Product[], expenses: Expense[], month: string) {
  return summarizeSold(soldInMonth(products, month), expensesInMonth(expenses, month));
}

export type MonthlyRow = SoldSummary & { month: string; purchaseSpend: number; purchaseCount: number };

/** 指定年の 1〜12 月 */
export function monthlySeries(products: Product[], expenses: Expense[], year: number): MonthlyRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    const purchased = products.filter((p) => monthKey(p.purchase_date) === month);
    return {
      month,
      ...monthlySummary(products, expenses, month),
      purchaseSpend: purchased.reduce((s, p) => s + p.purchase_price + p.other_purchase_cost, 0),
      purchaseCount: purchased.length,
    };
  });
}

export function yearlySummary(products: Product[], expenses: Expense[], year: number) {
  const y = String(year);
  const sold = soldProducts(products).filter((p) => p.sold_date!.startsWith(y));
  const exp = expenses.filter((e) => e.expense_date.startsWith(y));
  const s = summarizeSold(sold, exp);
  return {
    ...s,
    /** 総経費 = 送料 + 手数料 + その他経費 */
    totalExpenses: s.shipping + s.fees + s.otherCosts,
  };
}

/** データがある年（降順）。今年は必ず含む */
export function availableYears(products: Product[], expenses: Expense[], currentYear: number): number[] {
  const years = new Set<number>([currentYear]);
  for (const p of products) {
    years.add(Number(p.purchase_date.slice(0, 4)));
    if (p.sold_date) years.add(Number(p.sold_date.slice(0, 4)));
  }
  for (const e of expenses) years.add(Number(e.expense_date.slice(0, 4)));
  return [...years].sort((a, b) => b - a);
}

// -----------------------------------------------------------------------------
// ランキング
// -----------------------------------------------------------------------------
export type RankingKey = "profit" | "margin" | "sales";

export function ranking(products: Product[], key: RankingKey, limit = 10): Product[] {
  const value = (p: Product) =>
    key === "profit" ? p.profit ?? 0 : key === "margin" ? Number(p.profit_margin ?? 0) : salePriceOf(p);
  return [...soldProducts(products)].sort((a, b) => value(b) - value(a)).slice(0, limit);
}

// -----------------------------------------------------------------------------
// グループ分析（仕入先・店舗・ブランド・カテゴリ・販売先）
// -----------------------------------------------------------------------------
export type GroupRow = {
  key: string;
  label: string;
  purchaseCount: number;
  purchaseTotal: number;
  soldCount: number;
  sales: number;
  profit: number;
  avgProfit: number;
  avgMargin: number | null;
};

export function groupAnalysis(
  products: Product[],
  keyOf: (p: Product) => string | null,
  labelOf: (key: string) => string,
): GroupRow[] {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const k = keyOf(p) ?? "__none__";
    const list = map.get(k);
    if (list) list.push(p);
    else map.set(k, [p]);
  }
  const rows: GroupRow[] = [];
  for (const [key, list] of map) {
    const sold = soldProducts(list);
    const s = summarizeSold(sold);
    rows.push({
      key,
      label: key === "__none__" ? "未設定" : labelOf(key),
      purchaseCount: list.length,
      purchaseTotal: list.reduce((sum, p) => sum + p.purchase_price + p.other_purchase_cost, 0),
      soldCount: s.count,
      sales: s.sales,
      profit: s.profit,
      avgProfit: s.avgProfit,
      avgMargin: s.avgMargin,
    });
  }
  return rows.sort((a, b) => b.profit - a.profit || b.purchaseCount - a.purchaseCount);
}

// -----------------------------------------------------------------------------
// 在庫
// -----------------------------------------------------------------------------
export type StockAlertLevel = "none" | "warning" | "markdown" | "dispose";

export type AlertThresholds = Pick<
  Profile,
  "stock_alert_days_warning" | "stock_alert_days_markdown" | "stock_alert_days_dispose"
>;

export function stockAlertLevel(days: number, t: AlertThresholds): StockAlertLevel {
  if (days >= t.stock_alert_days_dispose) return "dispose";
  if (days >= t.stock_alert_days_markdown) return "markdown";
  if (days >= t.stock_alert_days_warning) return "warning";
  return "none";
}

export const STOCK_ALERT_META: Record<Exclude<StockAlertLevel, "none">, { emoji: string; label: string }> = {
  warning: { emoji: "⚠️", label: "日経過" },
  markdown: { emoji: "🔴", label: "値下げ検討" },
  dispose: { emoji: "🚨", label: "処分・再出品検討" },
};

export function stockDays(p: Product, today: string): number {
  return Math.max(0, daysBetween(p.purchase_date, today));
}

export const AGING_BUCKETS = [
  { label: "7日以内", max: 7 },
  { label: "8〜14日", max: 14 },
  { label: "15〜30日", max: 30 },
  { label: "31〜60日", max: 60 },
  { label: "61〜90日", max: 90 },
  { label: "91日以上", max: Infinity },
] as const;

export function inventorySummary(products: Product[], today: string, t: AlertThresholds) {
  const stock = products.filter((p) => isStock(p.status));
  const cost = stock.reduce((s, p) => s + p.purchase_price + p.other_purchase_cost, 0);
  const expectedSales = stock.reduce((s, p) => s + (p.expected_sale_price ?? 0), 0);
  const expectedProfit = stock.reduce((s, p) => s + (p.profit ?? 0), 0);
  const aging = AGING_BUCKETS.map((b) => ({ ...b, count: 0, cost: 0 }));
  const alerts = { warning: 0, markdown: 0, dispose: 0 };
  for (const p of stock) {
    const d = stockDays(p, today);
    const bucket = aging.find((b) => d <= b.max)!;
    bucket.count++;
    bucket.cost += p.purchase_price + p.other_purchase_cost;
    const level = stockAlertLevel(d, t);
    if (level !== "none") alerts[level]++;
  }
  return {
    stock,
    count: stock.length,
    cost,
    expectedSales,
    expectedProfit,
    aging,
    alerts,
    noPriceCount: stock.filter((p) => p.expected_sale_price === null).length,
  };
}

// -----------------------------------------------------------------------------
// 目標
// -----------------------------------------------------------------------------
export function goalProgress(currentProfit: number, goal: number, avgProfit: number) {
  const remaining = Math.max(0, goal - currentProfit);
  return {
    goal,
    current: currentProfit,
    remaining,
    rate: goal > 0 ? (currentProfit * 100) / goal : 0,
    remainingUnits: calcRemainingUnits(remaining, avgProfit),
    achieved: goal > 0 && currentProfit >= goal,
  };
}

/** 指定月 (YYYY-MM) の日別売却利益（一般経費は含まない） */
export function dailyProfitSeries(products: Product[], month: string): { key: string; value: number }[] {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDay = new Map<string, number>();
  for (const p of soldInMonth(products, month)) {
    byDay.set(p.sold_date!, (byDay.get(p.sold_date!) ?? 0) + (p.profit ?? 0));
  }
  return Array.from({ length: days }, (_, i) => {
    const key = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { key, value: byDay.get(key) ?? 0 };
  });
}
