import { describe, expect, it } from "vitest";
import { createHistoryAdvisor, tokenize } from "../ai/advisor";
import {
  calcMaxPurchasePrice,
  calcMaxPurchasePriceForCriteria,
  calcProfit,
  calcRemainingUnits,
  calcSellingFee,
  judgePurchase,
} from "../profit";
import type { Product } from "../types";

describe("calcSellingFee", () => {
  it("メルカリ10%", () => expect(calcSellingFee(20000, { fee_rate: 10, fee_fixed: 0 })).toBe(2000));
  it("端数は切り捨て", () => expect(calcSellingFee(1999, { fee_rate: 10, fee_fixed: 0 })).toBe(199));
  it("固定額", () => expect(calcSellingFee(1000, { fee_rate: 5, fee_fixed: 100 })).toBe(150));
  it("価格なし", () => expect(calcSellingFee(null, { fee_rate: 10, fee_fixed: 100 })).toBe(0));
});

describe("calcProfit", () => {
  it("仕様の計算例", () => {
    const r = calcProfit({ salePrice: 20000, purchasePrice: 8000, shippingCost: 750, sellingFee: 2000, otherCost: 0 });
    expect(r.profit).toBe(9250);
    expect(r.margin).toBe(46.25);
    expect(r.roi).toBe(115.63);
  });
  it("赤字", () => {
    const r = calcProfit({ salePrice: 1000, purchasePrice: 2000 });
    expect(r.profit).toBe(-1000);
    expect(r.margin).toBe(-100);
  });
  it("販売価格0なら利益率null", () => expect(calcProfit({ salePrice: 0, purchasePrice: 0 }).margin).toBeNull());
});

describe("calcMaxPurchasePrice", () => {
  it("仕様の計算例 → 12,250", () =>
    expect(calcMaxPurchasePrice({ salePrice: 20000, shippingCost: 750, sellingFee: 2000, targetProfit: 5000 })).toBe(12250));
  it("マイナスにならない", () =>
    expect(calcMaxPurchasePrice({ salePrice: 1000, shippingCost: 750, targetProfit: 5000 })).toBe(0));
  it("利益率基準も満たす", () => {
    // 必要利益 = max(5000, 20000*30%=6000) → 20000-750-2000-6000
    const v = calcMaxPurchasePriceForCriteria({ salePrice: 20000, shippingCost: 750, sellingFee: 2000, minProfit: 5000, minMargin: 30 });
    expect(v).toBe(11250);
    const r = calcProfit({ salePrice: 20000, purchasePrice: v, shippingCost: 750, sellingFee: 2000 });
    expect(judgePurchase(r.profit, r.margin)).toBe("recommend");
  });
});

describe("judgePurchase", () => {
  it("おすすめ", () => expect(judgePurchase(9250, 46.25)).toBe("recommend"));
  it("境界: 5000 / 30%", () => expect(judgePurchase(5000, 30)).toBe("recommend"));
  it("利益4,999 → 要検討", () => expect(judgePurchase(4999, 40)).toBe("consider"));
  it("利益率29.9% → 要検討", () => expect(judgePurchase(8000, 29.9)).toBe("consider"));
  it("利益3,000未満 → 見送り", () => expect(judgePurchase(2999, 50)).toBe("skip"));
  it("利益率20%未満 → 見送り", () => expect(judgePurchase(9000, 19.9)).toBe("skip"));
  it("利益率なし → 見送り", () => expect(judgePurchase(9000, null)).toBe("skip"));
  it("基準変更", () =>
    expect(judgePurchase(2000, 25, { recommend_min_profit: 2000, recommend_min_margin: 25, consider_min_profit: 1000, consider_min_margin: 10 })).toBe("recommend"));
});

describe("calcRemainingUnits", () => {
  it("仕様例: 残り40万 / 平均8,000 → 50個", () => expect(calcRemainingUnits(400000, 8000)).toBe(50));
  it("切り上げ", () => expect(calcRemainingUnits(400001, 8000)).toBe(51));
  it("達成済み", () => expect(calcRemainingUnits(0, 8000)).toBe(0));
  it("平均なし", () => expect(calcRemainingUnits(1000, 0)).toBeNull());
});


describe("advisor", () => {
  it("tokenize", () => expect(tokenize("CASIO G-SHOCK GA-2100")).toEqual(["casio", "g", "shock", "ga", "2100"].filter((t) => t.length >= 2)));
  it("類似商品の実績を集計", () => {
    const sold = {
      status: "sold", sold_date: "2026-10-12", purchase_date: "2026-10-01", profit: 4800, profit_margin: 35, name: "CASIO G-SHOCK GA-2100 ブラック", id: "x",
    } as unknown as Product;
    const r = createHistoryAdvisor([sold], { recommend_min_profit: 5000, recommend_min_margin: 30, consider_min_profit: 3000, consider_min_margin: 20 })
      .analyze({ name: "G-SHOCK GA-2100", purchasePrice: 5500, expectedSalePrice: 12000, expectedProfit: 5300, expectedMargin: 44 });
    expect(r.matchCount).toBe(1);
    expect(r.avgDaysToSell).toBe(11);
    expect(r.verdict).toBe("recommend");
  });
});
