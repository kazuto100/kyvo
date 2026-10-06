// 仕入れアドバイザー（将来の AI 判定の差し替えポイント）
//
// 現段階は「過去の販売データから似た商品を探して集計する」ルールベース実装。
// 将来は同じ PurchaseAdvisor インターフェースで LLM / 相場 API 実装に差し替える。

import { isSold } from "@/lib/constants";
import { daysBetween } from "@/lib/format";
import { judgePurchase, type Judgment, type JudgmentCriteria } from "@/lib/profit";
import type { Product } from "@/lib/types";

export type AdvisorInput = {
  name: string;
  brandName?: string;
  purchasePrice: number | null;
  expectedSalePrice: number | null;
  expectedProfit: number | null;
  expectedMargin: number | null;
};

export type AdvisorResult = {
  verdict: Judgment | null;
  matchCount: number;
  avgProfit: number | null;
  avgMargin: number | null;
  avgDaysToSell: number | null;
  reasons: string[];
  samples: Pick<Product, "id" | "name" | "profit" | "profit_margin">[];
};

/** ルールベース等、同期で結果を返す実装 */
export type SyncPurchaseAdvisor = { analyze(input: AdvisorInput): AdvisorResult };

export interface PurchaseAdvisor {
  analyze(input: AdvisorInput): Promise<AdvisorResult> | AdvisorResult;
}

/** 商品名をトークン化（英数字の型番・ブランド名・日本語の語） */
export function tokenize(text: string): string[] {
  return [
    ...new Set(
      text
        .normalize("NFKC")
        .toLowerCase()
        .split(/[\s/・,、。()（）[\]【】「」\-_]+/)
        .filter((t) => t.length >= 2),
    ),
  ];
}

export function createHistoryAdvisor(
  products: Product[],
  criteria: JudgmentCriteria,
): SyncPurchaseAdvisor {
  const sold = products
    .filter((p) => isSold(p.status) && p.sold_date && p.profit !== null)
    .map((p) => ({ p, tokens: tokenize(p.name) }));

  return {
    analyze(input) {
      const tokens = tokenize(`${input.brandName ?? ""} ${input.name}`);
      const reasons: string[] = [];
      if (tokens.length === 0) {
        return { verdict: null, matchCount: 0, avgProfit: null, avgMargin: null, avgDaysToSell: null, reasons, samples: [] };
      }
      // 型番など長いトークンの一致を重視したスコアリング
      const scored = sold
        .map(({ p, tokens: pt }) => {
          const score = tokens.reduce((s, t) => (pt.includes(t) ? s + Math.min(t.length, 8) : s), 0);
          return { p, score };
        })
        .filter((x) => x.score >= 4)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((x) => x.p);

      const n = scored.length;
      const avg = (f: (p: Product) => number) => (n ? scored.reduce((s, p) => s + f(p), 0) / n : null);
      const avgProfit = avg((p) => p.profit ?? 0);
      const avgMargin = avg((p) => Number(p.profit_margin ?? 0));
      const avgDaysToSell = avg((p) => Math.max(0, daysBetween(p.purchase_date, p.sold_date!)));

      let verdict: Judgment | null = null;
      if (input.expectedProfit !== null) {
        verdict = judgePurchase(input.expectedProfit, input.expectedMargin, criteria);
      }
      if (n > 0 && avgProfit !== null) {
        reasons.push(`類似商品 ${n}件の過去平均利益 ¥${Math.round(avgProfit).toLocaleString()}`);
        if (avgDaysToSell !== null) reasons.push(`平均販売期間 ${Math.round(avgDaysToSell)}日`);
        if (avgMargin !== null) reasons.push(`平均利益率 約${Math.round(avgMargin)}%`);
        const historical = judgePurchase(avgProfit, avgMargin, criteria);
        // 過去実績が想定より悪い場合は判定を一段階慎重に
        if (verdict === "recommend" && historical === "skip") {
          verdict = "consider";
          reasons.push("想定利益は高いが、過去実績は伸びていません");
        }
        if (avgDaysToSell !== null && avgDaysToSell > 60) reasons.push("売れるまで時間がかかる傾向");
      } else {
        reasons.push("類似商品の販売実績がまだありません");
      }
      return {
        verdict,
        matchCount: n,
        avgProfit,
        avgMargin,
        avgDaysToSell,
        reasons,
        samples: scored.slice(0, 3).map(({ id, name, profit, profit_margin }) => ({ id, name, profit, profit_margin })),
      };
    },
  };
}
