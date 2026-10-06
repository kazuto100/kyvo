"use client";

import { Check, Loader2, PackagePlus, RotateCcw, Sparkles, SquarePen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { JudgmentBanner } from "@/components/app/judgment";
import { Money, Percent } from "@/components/app/money";
import { PlatformPicker } from "@/components/app/platform-picker";
import { ShippingPicker } from "@/components/app/shipping-picker";
import { YenInput } from "@/components/app/yen-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProfitCalc, type ProfitCalc } from "@/hooks/use-profit-calc";
import { createHistoryAdvisor } from "@/lib/ai/advisor";
import { formatYen } from "@/lib/format";
import { JUDGMENT_META } from "@/lib/profit";
import { emptyProductInput, saveProduct } from "@/lib/product-service";
import type { MasterData, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "quick" | "simulator";

type Saved = { product: Product; calc: ProfitCalc };

/**
 * 店舗で使う計算画面
 *  - quick:     商品名・仕入価格・想定販売価格・送料・販売先だけで即登録
 *  - simulator: 仕入れるべきか・いくらまで出せるかを判断（登録も可能）
 */
export function PurchaseCalculator({
  mode,
  master,
  today,
  history = [],
}: {
  mode: Mode;
  master: MasterData;
  today: string;
  history?: Product[];
}) {
  const router = useRouter();
  const { profile, platforms, shippingTemplates } = master;
  const defaultPlatform = platforms.find((p) => p.is_active) ?? null;

  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [salePrice, setSalePrice] = useState<number | null>(null);
  const [shipping, setShipping] = useState<number | null>(shippingTemplates[0]?.cost ?? 0);
  const [platformId, setPlatformId] = useState<string | null>(defaultPlatform?.id ?? null);
  const [otherCost, setOtherCost] = useState<number | null>(null);
  const [targetProfit, setTargetProfit] = useState<number | null>(profile.recommend_min_profit);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [nameDialog, setNameDialog] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const platform = platforms.find((p) => p.id === platformId) ?? null;
  const calc = useProfitCalc({
    salePrice,
    purchasePrice,
    shippingCost: shipping,
    platform,
    otherCost,
    criteria: profile,
    targetProfit: targetProfit ?? 0,
  });

  const advisor = useMemo(() => createHistoryAdvisor(history, profile), [history, profile]);
  const advice = useMemo(
    () =>
      mode === "simulator" && name.trim().length >= 2
        ? advisor.analyze({
            name,
            purchasePrice,
            expectedSalePrice: salePrice,
            expectedProfit: calc.ready ? calc.profit : null,
            expectedMargin: calc.ready ? calc.margin : null,
          })
        : null,
    [advisor, mode, name, purchasePrice, salePrice, calc],
  );

  function reset() {
    setName("");
    setPurchasePrice(null);
    setSalePrice(null);
    setOtherCost(null);
    setSaved(null);
    setFormKey((k) => k + 1);
  }

  async function save() {
    if (!name.trim()) {
      if (mode === "simulator") setNameDialog(true);
      else toast.error("商品名を入力してください");
      return;
    }
    if (purchasePrice === null) {
      toast.error("仕入価格を入力してください");
      return;
    }
    setSaving(true);
    try {
      const product = await saveProduct(
        {
          ...emptyProductInput(today),
          id: crypto.randomUUID(),
          name: name.trim(),
          purchase_price: purchasePrice,
          expected_sale_price: salePrice,
          shipping_cost: shipping ?? 0,
          selling_platform_id: platformId,
          selling_fee: calc.fee,
          other_cost: otherCost ?? 0,
        },
        true,
      );
      setSaved({ product, calc });
      setNameDialog(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {/* 常に見える判定バー */}
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/85 px-4 py-2.5 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{calc.judgment ? JUDGMENT_META[calc.judgment].emoji : "🧮"}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted-foreground">
              {calc.judgment ? JUDGMENT_META[calc.judgment].label : "想定利益"}
            </div>
            <div className="flex items-baseline gap-2">
              <Money value={calc.ready ? calc.profit : null} tone="auto" className="text-xl font-bold" />
              <Percent value={calc.ready ? calc.margin : null} tone="auto" className="text-sm font-semibold" />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-muted-foreground">最大仕入価格</div>
            <Money value={calc.hasSalePrice ? calc.maxPurchasePrice : null} className="text-base font-bold text-brand" />
          </div>
        </div>
      </div>

      <div key={formKey} className="space-y-4 rounded-2xl border bg-card p-4">
        {mode === "quick" && (
          <Field label="商品名" htmlFor="q-name">
            <Input
              id="q-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: SONY α6400 ボディ"
              enterKeyHint="next"
              autoFocus
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="仕入価格" htmlFor="q-purchase">
            <YenInput id="q-purchase" value={purchasePrice} onChange={setPurchasePrice} size="lg" placeholder="0" autoFocus={mode === "simulator"} />
          </Field>
          <Field label="想定販売価格" htmlFor="q-sale">
            <YenInput id="q-sale" value={salePrice} onChange={setSalePrice} size="lg" placeholder="0" />
          </Field>
        </div>
        <Field label="販売先">
          <PlatformPicker platforms={platforms} value={platformId} onChange={setPlatformId} />
        </Field>
        <Field label="想定送料" htmlFor="q-shipping">
          <YenInput id="q-shipping" value={shipping} onChange={setShipping} />
          <ShippingPicker templates={shippingTemplates} value={shipping} onPick={setShipping} className="pt-1" />
        </Field>
        {mode === "simulator" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="その他経費" htmlFor="q-other">
              <YenInput id="q-other" value={otherCost} onChange={setOtherCost} placeholder="0" />
            </Field>
            <Field label="目標利益" htmlFor="q-target">
              <YenInput id="q-target" value={targetProfit} onChange={setTargetProfit} placeholder="0" />
            </Field>
          </div>
        )}
      </div>

      <MaxPurchaseCard calc={calc} purchasePrice={purchasePrice} recommendMinMargin={profile.recommend_min_margin} />

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">この商品を仕入れるべきか？</h2>
        <JudgmentBanner judgment={calc.judgment} />
        <dl className="space-y-1.5 text-[15px]">
          <Line label="想定販売価格" value={<Money value={calc.salePrice} />} />
          <Line label="仕入価格" value={<Money value={purchasePrice === null ? null : -purchasePrice} />} muted />
          <Line label="送料" value={<Money value={-calc.shippingCost} />} muted />
          <Line label={`手数料${platform ? `（${platform.name}）` : ""}`} value={<Money value={-calc.fee} />} muted />
          {mode === "simulator" && <Line label="その他経費" value={<Money value={-calc.otherCost} />} muted />}
          <div className="my-1 border-t" />
          <Line label="想定利益" value={<Money value={calc.ready ? calc.profit : null} tone="auto" className="text-2xl font-bold" />} />
          <Line label="利益率" value={<Percent value={calc.ready ? calc.margin : null} tone="auto" digits={2} className="text-lg font-bold" />} />
          <Line label="ROI（仕入額に対する利益）" value={<Percent value={calc.ready ? calc.roi : null} className="text-sm" />} muted />
        </dl>
      </section>

      {advice && (
        <section className="space-y-2 rounded-2xl border bg-card p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-brand" />
            過去データ分析
            <span className="rounded bg-brand-soft px-1.5 text-[10px] font-medium text-brand">β</span>
          </h2>
          {advice.verdict && (
            <p className="text-sm">
              判定: <b>{JUDGMENT_META[advice.verdict].emoji} {JUDGMENT_META[advice.verdict].label}</b>
            </p>
          )}
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            {advice.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {advice.samples.length > 0 && (
            <div className="space-y-1 pt-1">
              {advice.samples.map((s) => (
                <Link key={s.id} href={`/products/${s.id}`} className="flex justify-between gap-2 text-xs hover:underline">
                  <span className="truncate">{s.name}</span>
                  <Money value={s.profit} tone="auto" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="xl" onClick={reset} aria-label="リセット">
          <RotateCcw />
        </Button>
        <Button variant="brand" size="xl" className="flex-1" onClick={save} disabled={saving || purchasePrice === null}>
          {saving ? <Loader2 className="animate-spin" /> : <PackagePlus />}
          {mode === "quick" ? "仕入れ登録" : "この商品を仕入れ登録"}
        </Button>
      </div>

      {/* シミュレーターから登録する時の商品名入力 */}
      <Dialog open={nameDialog} onOpenChange={setNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>商品名を入力</DialogTitle>
            <DialogDescription>この条件で「仕入れ済み」として登録します。</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="space-y-3"
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="商品名" autoFocus />
            <Button type="submit" variant="brand" size="xl" className="w-full" disabled={!name.trim() || saving}>
              {saving && <Loader2 className="animate-spin" />}
              登録する
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 登録完了 → 結果表示 */}
      <Dialog open={!!saved} onOpenChange={(o) => !o && setSaved(null)}>
        <DialogContent>
          {saved && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-profit text-white">
                    <Check className="size-4" />
                  </span>
                  登録しました
                </DialogTitle>
                <DialogDescription className="truncate">{saved.product.name}</DialogDescription>
              </DialogHeader>
              <JudgmentBanner judgment={saved.calc.judgment} />
              <div className="grid grid-cols-2 gap-2.5">
                <ResultTile label="利益" value={<Money value={saved.product.profit} tone="auto" />} />
                <ResultTile label="利益率" value={<Percent value={saved.product.profit_margin} tone="auto" />} />
                <ResultTile
                  label={`最大仕入価格（利益${formatYen(saved.calc.targetProfit)}）`}
                  value={<Money value={saved.calc.hasSalePrice ? saved.calc.maxPurchasePrice : null} />}
                  className="col-span-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="lg" asChild>
                  <Link href={`/products/${saved.product.id}/edit`}>
                    <SquarePen />
                    詳細を編集
                  </Link>
                </Button>
                <Button variant="brand" size="lg" onClick={reset}>
                  <PackagePlus />
                  続けて登録
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MaxPurchaseCard({
  calc,
  purchasePrice,
  recommendMinMargin,
}: {
  calc: ProfitCalc;
  purchasePrice: number | null;
  recommendMinMargin: number;
}) {
  const diff = purchasePrice === null ? null : calc.maxPurchasePrice - purchasePrice;
  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="text-sm font-semibold">仕入れ上限価格</div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        利益 <b className="num">{formatYen(calc.targetProfit)}</b> 以上で売るなら、いくらまで仕入れていい？
      </p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">最大仕入価格</div>
          <Money
            value={calc.hasSalePrice ? calc.maxPurchasePrice : null}
            className="text-[40px] leading-none font-bold tracking-tight text-brand"
          />
        </div>
        {calc.hasSalePrice && diff !== null && (
          <span
            className={cn(
              "mb-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              diff >= 0 ? "bg-profit-soft text-profit" : "bg-loss-soft text-loss",
            )}
          >
            {diff >= 0 ? `あと${formatYen(diff)}余裕` : `${formatYen(-diff)}オーバー`}
          </span>
        )}
      </div>
      {calc.hasSalePrice && (
        <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          🔥判定（利益率{recommendMinMargin}%以上も満たす）になる上限は{" "}
          <b className="num text-foreground">{formatYen(calc.maxPurchasePriceForRecommend)}</b>
        </p>
      )}
    </section>
  );
}

function Line({ label, value, muted }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? "text-sm text-muted-foreground" : "font-medium"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ResultTile({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-secondary px-3.5 py-3", className)}>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
