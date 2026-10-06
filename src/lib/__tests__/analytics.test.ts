import { describe, expect, it } from "vitest";
import { goalProgress, groupAnalysis, inventorySummary, monthlySummary, ranking, stockAlertLevel } from "../analytics";
import type { Expense, Product } from "../types";

const base: Product = {
  id: "", user_id: "u", name: "", brand_id: null, category_id: null, condition: null, image_urls: [], memo: null,
  supplier_id: null, purchase_store_id: null, purchase_date: "2026-10-01", purchase_price: 0, other_purchase_cost: 0,
  selling_platform_id: null, expected_sale_price: null, actual_sale_price: null, listing_date: null, sold_date: null,
  listing_url: null, status: "purchased", shipping_cost: 0, selling_fee: 0, selling_fee_auto: true, other_cost: 0,
  profit: null, profit_margin: null, roi: null, created_at: "", updated_at: "",
};
const p = (o: Partial<Product>): Product => ({ ...base, ...o });

const products: Product[] = [
  p({ id: "1", name: "A", status: "sold", sold_date: "2026-10-05", purchase_price: 8000, actual_sale_price: 20000, shipping_cost: 750, selling_fee: 2000, profit: 9250, profit_margin: 46.25, supplier_id: "s1" }),
  p({ id: "2", name: "B", status: "shipped", sold_date: "2026-10-06", purchase_price: 1000, actual_sale_price: 5000, shipping_cost: 210, selling_fee: 500, other_cost: 90, profit: 3200, profit_margin: 64, supplier_id: "s1" }),
  p({ id: "3", name: "C", status: "sold", sold_date: "2026-09-30", purchase_price: 1000, actual_sale_price: 3000, profit: 2000, profit_margin: 66.67 }),
  p({ id: "4", name: "D", status: "listed", purchase_date: "2026-07-01", purchase_price: 3000, expected_sale_price: 9000, profit: 5000, supplier_id: "s2" }),
];
const expenses: Expense[] = [{ id: "e", expense_date: "2026-10-02", category: "梱包資材", amount: 450, memo: null }];

describe("monthlySummary", () => {
  it("当月の売却のみ集計し、一般経費を差し引く", () => {
    const s = monthlySummary(products, expenses, "2026-10");
    expect(s.count).toBe(2);
    expect(s.sales).toBe(25000);
    expect(s.costOfGoods).toBe(9000);
    expect(s.shipping).toBe(960);
    expect(s.fees).toBe(2500);
    expect(s.otherCosts).toBe(540);
    expect(s.profit).toBe(9250 + 3200 - 450);
    expect(s.avgProfit).toBe((9250 + 3200) / 2);
  });
});

describe("goalProgress", () => {
  it("仕様例", () => {
    const g = goalProgress(600000, 1000000, 8000);
    expect(g.remaining).toBe(400000);
    expect(g.remainingUnits).toBe(50);
    expect(g.rate).toBe(60);
  });
});

describe("inventory", () => {
  it("在庫集計とアラート", () => {
    const t = { stock_alert_days_warning: 30, stock_alert_days_markdown: 60, stock_alert_days_dispose: 90 };
    const s = inventorySummary(products, "2026-10-06", t);
    expect(s.count).toBe(1);
    expect(s.cost).toBe(3000);
    expect(s.alerts.dispose).toBe(1);
    expect(stockAlertLevel(29, t)).toBe("none");
    expect(stockAlertLevel(30, t)).toBe("warning");
    expect(stockAlertLevel(60, t)).toBe("markdown");
  });
});

describe("ranking / groupAnalysis", () => {
  it("利益TOP", () => expect(ranking(products, "profit").map((x) => x.id)).toEqual(["1", "2", "3"]));
  it("利益率TOP", () => expect(ranking(products, "margin")[0].id).toBe("3"));
  it("仕入先別", () => {
    const rows = groupAnalysis(products, (x) => x.supplier_id, (k) => k);
    const s1 = rows.find((r) => r.key === "s1")!;
    expect(s1.purchaseCount).toBe(2);
    expect(s1.profit).toBe(12450);
    expect(rows.find((r) => r.key === "__none__")!.label).toBe("未設定");
  });
});
