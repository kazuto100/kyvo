"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useProfitCalc } from "@/hooks/use-profit-calc";
import { updateProduct } from "@/lib/product-service";
import type { MasterData, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 売却登録：販売価格・販売日・送料を入れると利益が確定し、月間利益に反映される */
export function SellDialog({
  product,
  master,
  today,
  open,
  onOpenChange,
}: {
  product: Product;
  master: MasterData;
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { platforms, shippingTemplates, profile } = master;
  const [salePrice, setSalePrice] = useState<number | null>(product.actual_sale_price ?? product.expected_sale_price);
  const [soldDate, setSoldDate] = useState(product.sold_date ?? today);
  const [platformId, setPlatformId] = useState<string | null>(product.selling_platform_id ?? platforms[0]?.id ?? null);
  const [shipping, setShipping] = useState<number | null>(product.shipping_cost);
  const [otherCost, setOtherCost] = useState<number | null>(product.other_cost || null);
  const [feeAuto, setFeeAuto] = useState(product.selling_fee_auto);
  const [manualFee, setManualFee] = useState<number | null>(product.selling_fee);
  const [status, setStatus] = useState<"sold" | "shipped">(product.status === "shipped" ? "shipped" : "sold");
  const [saving, setSaving] = useState(false);

  const platform = platforms.find((p) => p.id === platformId) ?? null;
  const calc = useProfitCalc({
    salePrice,
    purchasePrice: product.purchase_price,
    otherPurchaseCost: product.other_purchase_cost,
    shippingCost: shipping,
    platform,
    feeAuto,
    manualFee,
    otherCost,
    criteria: profile,
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!salePrice) {
      toast.error("販売価格を入力してください");
      return;
    }
    setSaving(true);
    try {
      const saved = await updateProduct(product.id, {
        status,
        actual_sale_price: salePrice,
        sold_date: soldDate || today,
        selling_platform_id: platformId,
        shipping_cost: shipping ?? 0,
        other_cost: otherCost ?? 0,
        selling_fee_auto: feeAuto,
        selling_fee: calc.fee,
      });
      toast.success(`売却を登録しました（利益 ¥${(saved.profit ?? 0).toLocaleString()}）`);
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>売却を登録</DialogTitle>
          <DialogDescription className="truncate">{product.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="販売価格" htmlFor="sell-price">
              <YenInput id="sell-price" value={salePrice} onChange={setSalePrice} size="lg" autoFocus />
            </Field>
            <Field label="販売日" htmlFor="sell-date">
              <Input id="sell-date" type="date" value={soldDate} max={today} onChange={(e) => setSoldDate(e.target.value)} className="h-14" />
            </Field>
          </div>
          <Field label="販売先">
            <PlatformPicker platforms={platforms} value={platformId} onChange={setPlatformId} />
          </Field>
          <Field label="送料" htmlFor="sell-shipping">
            <YenInput id="sell-shipping" value={shipping} onChange={setShipping} />
            <ShippingPicker templates={shippingTemplates} value={shipping} onPick={setShipping} className="pt-1" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="販売手数料"
              htmlFor="sell-fee"
              right={
                <button type="button" className="text-xs text-brand" onClick={() => setFeeAuto((v) => !v)}>
                  {feeAuto ? "手入力" : "自動"}
                </button>
              }
            >
              <YenInput id="sell-fee" value={feeAuto ? calc.fee : manualFee} onChange={setManualFee} disabled={feeAuto} />
            </Field>
            <Field label="その他経費" htmlFor="sell-other">
              <YenInput id="sell-other" value={otherCost} onChange={setOtherCost} placeholder="0" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-secondary p-1">
            {(["sold", "shipped"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "h-10 rounded-lg text-sm font-medium transition",
                  status === s ? "bg-surface shadow-sm" : "text-muted-foreground",
                )}
              >
                {s === "sold" ? "売却済み（未発送）" : "発送済み"}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
            <div>
              <div className="text-xs text-muted-foreground">確定利益</div>
              <Money value={calc.profit} tone="auto" className="text-2xl font-bold" />
            </div>
            <Percent value={calc.margin} tone="auto" digits={2} className="text-lg font-bold" />
          </div>
          {calc.judgment === "skip" && <JudgmentBanner judgment="skip" className="py-2.5" />}
          <Button type="submit" variant="brand" size="xl" className="w-full" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            売却を登録する
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
