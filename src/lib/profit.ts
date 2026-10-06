// 利益計算ロジック（DB トリガー public.products_compute と同じ式）
//
//   利益   = 販売価格 − 仕入価格 − その他仕入経費 − 送料 − 販売手数料 − その他経費
//   利益率 = 利益 ÷ 販売価格 × 100      （売上に対する利益率）
//   ROI    = 利益 ÷ 仕入原価 × 100      （将来用）

export type FeeRule = { fee_rate: number; fee_fixed: number };

export type ProfitInput = {
  salePrice: number | null | undefined;
  purchasePrice: number | null | undefined;
  otherPurchaseCost?: number | null;
  shippingCost?: number | null;
  sellingFee?: number | null;
  otherCost?: number | null;
};

export type ProfitResult = {
  salePrice: number;
  costOfGoods: number;
  shippingCost: number;
  sellingFee: number;
  otherCost: number;
  profit: number;
  /** 利益率（%）。販売価格 0 の場合は null */
  margin: number | null;
  /** ROI（%）。仕入原価 0 の場合は null */
  roi: number | null;
};

const n = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** 販売手数料 = floor(販売価格 × 料率 / 100) + 固定額 */
export function calcSellingFee(
  salePrice: number | null | undefined,
  rule: FeeRule | null | undefined,
): number {
  const price = n(salePrice);
  if (price <= 0 || !rule) return 0;
  return Math.floor((price * n(rule.fee_rate)) / 100) + n(rule.fee_fixed);
}

export function calcProfit(input: ProfitInput): ProfitResult {
  const salePrice = n(input.salePrice);
  const costOfGoods = n(input.purchasePrice) + n(input.otherPurchaseCost);
  const shippingCost = n(input.shippingCost);
  const sellingFee = n(input.sellingFee);
  const otherCost = n(input.otherCost);
  const profit = salePrice - costOfGoods - shippingCost - sellingFee - otherCost;
  return {
    salePrice,
    costOfGoods,
    shippingCost,
    sellingFee,
    otherCost,
    profit,
    margin: salePrice > 0 ? round2((profit * 100) / salePrice) : null,
    roi: costOfGoods > 0 ? round2((profit * 100) / costOfGoods) : null,
  };
}

/**
 * 目標利益を確保できる最大仕入価格
 *   = 販売価格 − 送料 − 手数料 − その他経費 − その他仕入経費 − 目標利益
 */
export function calcMaxPurchasePrice(input: {
  salePrice: number | null | undefined;
  shippingCost?: number | null;
  sellingFee?: number | null;
  otherCost?: number | null;
  otherPurchaseCost?: number | null;
  targetProfit: number;
}): number {
  const v =
    n(input.salePrice) -
    n(input.shippingCost) -
    n(input.sellingFee) -
    n(input.otherCost) -
    n(input.otherPurchaseCost) -
    n(input.targetProfit);
  return Math.max(0, Math.floor(v));
}

/**
 * 「目標利益」と「最低利益率」の両方を満たす最大仕入価格
 * （利益率は販売価格基準なので、必要利益 = max(目標利益, 販売価格 × 最低利益率)）
 */
export function calcMaxPurchasePriceForCriteria(input: {
  salePrice: number | null | undefined;
  shippingCost?: number | null;
  sellingFee?: number | null;
  otherCost?: number | null;
  otherPurchaseCost?: number | null;
  minProfit: number;
  minMargin: number;
}): number {
  const required = Math.max(
    n(input.minProfit),
    Math.ceil((n(input.salePrice) * n(input.minMargin)) / 100),
  );
  return calcMaxPurchasePrice({ ...input, targetProfit: required });
}

// -----------------------------------------------------------------------------
// 仕入れ判断
// -----------------------------------------------------------------------------
export type JudgmentCriteria = {
  recommend_min_profit: number;
  recommend_min_margin: number;
  consider_min_profit: number;
  consider_min_margin: number;
};

export const DEFAULT_CRITERIA: JudgmentCriteria = {
  recommend_min_profit: 5000,
  recommend_min_margin: 30,
  consider_min_profit: 3000,
  consider_min_margin: 20,
};

export type Judgment = "recommend" | "consider" | "skip";

/**
 * 🔥 仕入れおすすめ : 利益 ≥ 5,000 かつ 利益率 ≥ 30%
 * ❌ 見送り         : 利益 < 3,000 または 利益率 < 20%
 * ⚠️ 要検討         : それ以外
 */
export function judgePurchase(
  profit: number,
  margin: number | null,
  criteria: JudgmentCriteria = DEFAULT_CRITERIA,
): Judgment {
  const m = margin ?? -Infinity;
  if (profit >= criteria.recommend_min_profit && m >= criteria.recommend_min_margin) {
    return "recommend";
  }
  if (profit < criteria.consider_min_profit || m < criteria.consider_min_margin) {
    return "skip";
  }
  return "consider";
}

export const JUDGMENT_META: Record<
  Judgment,
  { label: string; emoji: string; description: string }
> = {
  recommend: { label: "仕入れおすすめ", emoji: "🔥", description: "利益・利益率ともに基準クリア" },
  consider: { label: "要検討", emoji: "⚠️", description: "利益か利益率が基準に届いていません" },
  skip: { label: "見送り", emoji: "❌", description: "利益が出にくい商品です" },
};

/** 目標達成に必要な残り販売数 */
export function calcRemainingUnits(remainingProfit: number, avgProfit: number): number | null {
  if (remainingProfit <= 0) return 0;
  if (!(avgProfit > 0)) return null;
  return Math.ceil(remainingProfit / avgProfit);
}
