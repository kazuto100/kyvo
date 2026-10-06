"use client";

import { useMemo } from "react";
import {
  calcMaxPurchasePrice,
  calcMaxPurchasePriceForCriteria,
  calcProfit,
  calcSellingFee,
  judgePurchase,
  type JudgmentCriteria,
} from "@/lib/profit";
import type { Platform } from "@/lib/types";

export type ProfitCalcInput = {
  salePrice: number | null;
  purchasePrice: number | null;
  otherPurchaseCost?: number | null;
  shippingCost: number | null;
  platform: Platform | null | undefined;
  /** false の場合 manualFee を使う */
  feeAuto?: boolean;
  manualFee?: number | null;
  otherCost?: number | null;
  criteria: JudgmentCriteria;
  /** 最大仕入価格の計算に使う目標利益（省略時はおすすめ基準の利益） */
  targetProfit?: number | null;
};

/** 入力のたびにリアルタイムで利益・利益率・判定・最大仕入価格を計算 */
export function useProfitCalc(input: ProfitCalcInput) {
  const {
    salePrice,
    purchasePrice,
    otherPurchaseCost,
    shippingCost,
    platform,
    feeAuto = true,
    manualFee,
    otherCost,
    criteria,
    targetProfit,
  } = input;

  return useMemo(() => {
    const fee = feeAuto ? calcSellingFee(salePrice, platform) : (manualFee ?? 0);
    const result = calcProfit({
      salePrice,
      purchasePrice,
      otherPurchaseCost,
      shippingCost,
      sellingFee: fee,
      otherCost,
    });
    const ready = salePrice !== null && salePrice > 0 && purchasePrice !== null;
    const target = targetProfit ?? criteria.recommend_min_profit;
    const costs = { salePrice, shippingCost, sellingFee: fee, otherCost, otherPurchaseCost };
    return {
      ...result,
      fee,
      ready,
      hasSalePrice: salePrice !== null && salePrice > 0,
      judgment: ready ? judgePurchase(result.profit, result.margin, criteria) : null,
      targetProfit: target,
      maxPurchasePrice: calcMaxPurchasePrice({ ...costs, targetProfit: target }),
      maxPurchasePriceForRecommend: calcMaxPurchasePriceForCriteria({
        ...costs,
        minProfit: criteria.recommend_min_profit,
        minMargin: criteria.recommend_min_margin,
      }),
    };
  }, [salePrice, purchasePrice, otherPurchaseCost, shippingCost, platform, feeAuto, manualFee, otherCost, criteria, targetProfit]);
}

export type ProfitCalc = ReturnType<typeof useProfitCalc>;
