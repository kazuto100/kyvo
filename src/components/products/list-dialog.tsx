"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { JudgmentBanner } from "@/components/app/judgment";
import { Money, Percent } from "@/components/app/money";
import { PlatformPicker } from "@/components/app/platform-picker";
import { YenInput } from "@/components/app/yen-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProfitCalc } from "@/hooks/use-profit-calc";
import { isSold } from "@/lib/constants";
import { updateProduct } from "@/lib/product-service";
import type { MasterData, Product } from "@/lib/types";

/** 出品登録：販売先・出品価格・出品日・出品URLを入れて「出品中」にする */
export function ListDialog({
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
  const { platforms, profile } = master;
  const [platformId, setPlatformId] = useState<string | null>(
    product.selling_platform_id ?? platforms.find((p) => p.is_active)?.id ?? null,
  );
  const [price, setPrice] = useState<number | null>(product.expected_sale_price);
  const [listingDate, setListingDate] = useState(product.listing_date ?? today);
  const [url, setUrl] = useState(product.listing_url ?? "");
  const [saving, setSaving] = useState(false);
  const sold = isSold(product.status);

  const platform = platforms.find((p) => p.id === platformId) ?? null;
  const calc = useProfitCalc({
    salePrice: price,
    purchasePrice: product.purchase_price,
    otherPurchaseCost: product.other_purchase_cost,
    shippingCost: product.shipping_cost,
    platform,
    feeAuto: product.selling_fee_auto,
    manualFee: product.selling_fee,
    otherCost: product.other_cost,
    criteria: profile,
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error("出品URLは http(s):// から始まるURLを入力してください");
      return;
    }
    if (!price) {
      toast.error("出品価格を入力してください");
      return;
    }
    setSaving(true);
    try {
      await updateProduct(product.id, {
        // 売却済みの商品は出品情報だけ更新し、ステータスは変えない
        ...(sold ? {} : { status: "listed" as const }),
        selling_platform_id: platformId,
        expected_sale_price: price,
        listing_date: listingDate || today,
        listing_url: trimmed || null,
      });
      toast.success(sold ? "出品情報を更新しました" : "出品中にしました");
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
          <DialogTitle>{product.status === "listed" || sold ? "出品情報" : "出品を登録"}</DialogTitle>
          <DialogDescription className="truncate">{product.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-4">
          <Field label="販売先">
            <PlatformPicker platforms={platforms} value={platformId} onChange={setPlatformId} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="出品価格" htmlFor="list-price">
              <YenInput id="list-price" value={price} onChange={setPrice} size="lg" autoFocus />
            </Field>
            <Field label="出品日" htmlFor="list-date">
              <Input id="list-date" type="date" value={listingDate} max={today} onChange={(e) => setListingDate(e.target.value)} className="h-14" />
            </Field>
          </div>
          <Field label="出品URL" htmlFor="list-url" hint="一覧・詳細から「出品ページを開く」で開けます">
            <Input
              id="list-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://jp.mercari.com/item/..."
            />
          </Field>
          <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
            <div>
              <div className="text-xs text-muted-foreground">この価格で売れた場合の利益</div>
              <Money value={calc.ready ? calc.profit : null} tone="auto" className="text-2xl font-bold" />
            </div>
            <Percent value={calc.ready ? calc.margin : null} tone="auto" digits={2} className="text-lg font-bold" />
          </div>
          {calc.judgment === "skip" && <JudgmentBanner judgment="skip" className="py-2.5" />}
          <Button type="submit" variant="brand" size="xl" className="w-full" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {sold ? "保存する" : "出品中にする"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
