"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { ImageUploader, type UploadedImage } from "@/components/app/image-uploader";
import { JudgmentBanner, JudgmentPill } from "@/components/app/judgment";
import { Money, Percent } from "@/components/app/money";
import { PlatformPicker } from "@/components/app/platform-picker";
import { ShippingPicker } from "@/components/app/shipping-picker";
import { YenInput } from "@/components/app/yen-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDiscardUnsavedImages } from "@/hooks/use-discard-unsaved-images";
import { useProfitCalc } from "@/hooks/use-profit-calc";
import { CONDITIONS, isSold, STATUS_META } from "@/lib/constants";
import { deleteProductImages } from "@/lib/images";
import { createStore, emptyProductInput, ensureBrand, saveProduct, toProductInput } from "@/lib/product-service";
import { PRODUCT_STATUSES, type MasterData, type Product, type ProductInput } from "@/lib/types";
import { cn } from "@/lib/utils";

const NEW_STORE = "__new__";

type Props = {
  master: MasterData;
  userId: string;
  today: string;
  product?: Product;
  initialImages?: UploadedImage[];
};

export function ProductForm({ master, userId, today, product, initialImages = [] }: Props) {
  const router = useRouter();
  const isNew = !product;
  const [productId] = useState(() => product?.id ?? crypto.randomUUID());
  const { profile, platforms, categories, brands, suppliers, stores, shippingTemplates } = master;

  const defaultPlatform = platforms.find((p) => p.is_active) ?? null;
  const [form, setForm] = useState<ProductInput>(() =>
    product
      ? toProductInput(product)
      : { ...emptyProductInput(today), selling_platform_id: defaultPlatform?.id ?? null },
  );
  const [purchasePrice, setPurchasePrice] = useState<number | null>(product ? product.purchase_price : null);
  const [brandName, setBrandName] = useState(() => brands.find((b) => b.id === product?.brand_id)?.name ?? "");
  const [newStoreName, setNewStoreName] = useState("");
  const [storeSelect, setStoreSelect] = useState<string>(product?.purchase_store_id ?? "");
  const [images, setImages] = useState<UploadedImage[]>(initialImages);
  const { markSaved } = useDiscardUnsavedImages(images);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const sold = isSold(form.status);
  const platform = platforms.find((p) => p.id === form.selling_platform_id) ?? null;
  // DB と同じく「確定販売価格 → 想定販売価格」の順で採用
  const salePrice = form.actual_sale_price ?? form.expected_sale_price;

  const calc = useProfitCalc({
    salePrice,
    purchasePrice,
    otherPurchaseCost: form.other_purchase_cost,
    shippingCost: form.shipping_cost,
    platform,
    feeAuto: form.selling_fee_auto,
    manualFee: form.selling_fee,
    otherCost: form.other_cost,
    criteria: profile,
  });

  const storesBySupplier = useMemo(() => {
    const groups = new Map<string, typeof stores>();
    for (const s of stores) {
      const key = s.supplier_id ?? "";
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return groups;
  }, [stores]);

  function onStoreChange(value: string) {
    setStoreSelect(value);
    if (value === NEW_STORE) return;
    const store = stores.find((s) => s.id === value);
    set("purchase_store_id", store?.id ?? null);
    if (store?.supplier_id && !form.supplier_id) set("supplier_id", store.supplier_id);
  }

  function onStatusChange(status: ProductInput["status"]) {
    setForm((f) => ({
      ...f,
      status,
      sold_date: isSold(status) ? (f.sold_date ?? today) : f.sold_date,
      actual_sale_price: isSold(status) ? (f.actual_sale_price ?? f.expected_sale_price) : f.actual_sale_price,
      listing_date: status === "listed" ? (f.listing_date ?? today) : f.listing_date,
    }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "商品名を入力してください";
    if (purchasePrice === null) e.purchase_price = "仕入価格を入力してください";
    if (sold && !form.actual_sale_price) e.actual_sale_price = "販売価格を入力してください";
    if (storeSelect === NEW_STORE && !newStoreName.trim()) e.store = "店舗名を入力してください";
    if (form.listing_url && !/^https?:\/\//.test(form.listing_url)) e.listing_url = "http(s):// から始まるURLを入力してください";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) {
      toast.error("入力内容を確認してください");
      return;
    }
    setSaving(true);
    try {
      const brand_id = await ensureBrand(brandName, brands);
      let purchase_store_id = form.purchase_store_id;
      if (storeSelect === NEW_STORE) {
        purchase_store_id = (await createStore(newStoreName, form.supplier_id)).id;
      }
      const imagePaths = images.map((i) => i.path);
      const saved = await saveProduct(
        {
          ...form,
          id: productId,
          name: form.name.trim(),
          brand_id,
          purchase_store_id,
          purchase_price: purchasePrice ?? 0,
          selling_fee: calc.fee,
          image_urls: imagePaths,
          memo: form.memo?.trim() || null,
          listing_url: form.listing_url?.trim() || null,
        },
        isNew,
      );
      markSaved();
      // 編集で外された保存済み画像を Storage から削除
      const removed = (product?.image_urls ?? []).filter((p) => !imagePaths.includes(p));
      void deleteProductImages(removed);
      toast.success(isNew ? "商品を登録しました" : "商品を更新しました");
      router.push(`/products/${saved.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 pb-40 lg:pb-28">
      <Section title="商品情報" defaultOpen>
        <Field label="商品名" htmlFor="name" hint={errors.name && <span className="text-loss">{errors.name}</span>}>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="例: CASIO G-SHOCK GA-2100"
            aria-invalid={!!errors.name}
            autoFocus={isNew}
            enterKeyHint="next"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="ブランド" htmlFor="brand">
            <Input
              id="brand"
              list="brand-options"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="入力 or 選択"
              autoComplete="off"
            />
            <datalist id="brand-options">
              {brands.map((b) => (
                <option key={b.id} value={b.name} />
              ))}
            </datalist>
          </Field>
          <Field label="カテゴリ" htmlFor="category">
            <NativeSelect
              id="category"
              value={form.category_id ?? ""}
              onChange={(e) => set("category_id", e.target.value || null)}
            >
              <option value="">未設定</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="商品状態" htmlFor="condition">
            <NativeSelect id="condition" value={form.condition ?? ""} onChange={(e) => set("condition", e.target.value || null)}>
              <option value="">未設定</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="ステータス" htmlFor="status">
            <NativeSelect
              id="status"
              value={form.status}
              onChange={(e) => onStatusChange(e.target.value as ProductInput["status"])}
            >
              {PRODUCT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </Section>

      <Section title="仕入情報" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="仕入価格"
            htmlFor="purchase_price"
            hint={errors.purchase_price && <span className="text-loss">{errors.purchase_price}</span>}
          >
            <YenInput id="purchase_price" value={purchasePrice} onChange={setPurchasePrice} size="lg" placeholder="0" aria-invalid={!!errors.purchase_price} />
          </Field>
          <Field label="仕入日" htmlFor="purchase_date">
            <Input
              id="purchase_date"
              type="date"
              value={form.purchase_date}
              max={today}
              onChange={(e) => set("purchase_date", e.target.value || today)}
              className="h-14"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="仕入先" htmlFor="supplier">
            <NativeSelect id="supplier" value={form.supplier_id ?? ""} onChange={(e) => set("supplier_id", e.target.value || null)}>
              <option value="">未設定</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="仕入店舗" htmlFor="store" hint={errors.store && <span className="text-loss">{errors.store}</span>}>
            <NativeSelect id="store" value={storeSelect} onChange={(e) => onStoreChange(e.target.value)}>
              <option value="">未設定</option>
              {[...storesBySupplier.entries()].map(([supplierId, list]) => {
                const label = suppliers.find((s) => s.id === supplierId)?.name ?? "その他";
                return (
                  <optgroup key={supplierId || "none"} label={label}>
                    {list.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
              <option value={NEW_STORE}>＋ 新しい店舗を追加…</option>
            </NativeSelect>
          </Field>
        </div>
        {storeSelect === NEW_STORE && (
          <Field label="新しい店舗名" htmlFor="new_store" hint="保存時に店舗マスタへ追加されます（仕入先と紐づけ）">
            <Input
              id="new_store"
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              placeholder="例: セカンドストリート多治見店"
            />
          </Field>
        )}
        <Field label="その他仕入経費" htmlFor="other_purchase_cost" hint="交通費の按分・修理代など、仕入れに付随する費用">
          <YenInput
            id="other_purchase_cost"
            value={form.other_purchase_cost || null}
            onChange={(v) => set("other_purchase_cost", v ?? 0)}
            placeholder="0"
          />
        </Field>
      </Section>

      <Section title="販売情報" defaultOpen>
        <Field label="販売先">
          <PlatformPicker platforms={platforms} value={form.selling_platform_id} onChange={(id) => set("selling_platform_id", id)} allowNone />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="想定販売価格" htmlFor="expected_sale_price">
            <YenInput
              id="expected_sale_price"
              value={form.expected_sale_price}
              onChange={(v) => set("expected_sale_price", v)}
              size="lg"
              placeholder="0"
            />
          </Field>
          <Field
            label={sold ? "販売価格（確定）" : "販売価格"}
            htmlFor="actual_sale_price"
            hint={errors.actual_sale_price ? <span className="text-loss">{errors.actual_sale_price}</span> : !sold && "売れたら入力"}
          >
            <YenInput
              id="actual_sale_price"
              value={form.actual_sale_price}
              onChange={(v) => set("actual_sale_price", v)}
              size="lg"
              placeholder="—"
              aria-invalid={!!errors.actual_sale_price}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="出品日" htmlFor="listing_date">
            <Input id="listing_date" type="date" value={form.listing_date ?? ""} onChange={(e) => set("listing_date", e.target.value || null)} />
          </Field>
          <Field label="販売日" htmlFor="sold_date">
            <Input id="sold_date" type="date" value={form.sold_date ?? ""} onChange={(e) => set("sold_date", e.target.value || null)} />
          </Field>
        </div>
        <Field label="出品URL" htmlFor="listing_url" hint={errors.listing_url && <span className="text-loss">{errors.listing_url}</span>}>
          <Input
            id="listing_url"
            type="url"
            inputMode="url"
            value={form.listing_url ?? ""}
            onChange={(e) => set("listing_url", e.target.value)}
            placeholder="https://jp.mercari.com/item/..."
            aria-invalid={!!errors.listing_url}
          />
        </Field>
      </Section>

      <Section title="費用" defaultOpen>
        <Field label="送料" htmlFor="shipping_cost">
          <YenInput id="shipping_cost" value={form.shipping_cost} onChange={(v) => set("shipping_cost", v ?? 0)} />
          <ShippingPicker templates={shippingTemplates} value={form.shipping_cost} onPick={(c) => set("shipping_cost", c)} className="pt-1" />
        </Field>
        <Field
          label="販売手数料"
          htmlFor="selling_fee"
          right={
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              自動計算
              <Switch
                checked={form.selling_fee_auto}
                onCheckedChange={(v) => setForm((f) => ({ ...f, selling_fee_auto: v, selling_fee: calc.fee }))}
              />
            </label>
          }
          hint={form.selling_fee_auto && (platform ? `${platform.name}の手数料設定から自動計算` : "販売先を選ぶと自動計算されます")}
        >
          <YenInput
            id="selling_fee"
            value={form.selling_fee_auto ? calc.fee : form.selling_fee}
            onChange={(v) => set("selling_fee", v ?? 0)}
            disabled={form.selling_fee_auto}
          />
        </Field>
        <Field label="その他経費" htmlFor="other_cost" hint="梱包資材・クリーニング代など">
          <YenInput id="other_cost" value={form.other_cost || null} onChange={(v) => set("other_cost", v ?? 0)} placeholder="0" />
        </Field>
      </Section>

      <Section title="写真・メモ" defaultOpen={!isNew || images.length > 0}>
        <ImageUploader userId={userId} productId={productId} images={images} onChange={setImages} onBusyChange={setImagesBusy} />
        <Field label="商品メモ" htmlFor="memo">
          <Textarea
            id="memo"
            value={form.memo ?? ""}
            onChange={(e) => set("memo", e.target.value)}
            placeholder="型番・付属品・傷の状態など"
          />
        </Field>
      </Section>

      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 text-sm font-semibold">仕入れ判断</div>
        <JudgmentBanner judgment={calc.judgment} />
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          <Row label="販売価格" value={<Money value={calc.salePrice} />} />
          <Row label="仕入原価" value={<Money value={-calc.costOfGoods} />} />
          <Row label="送料" value={<Money value={-calc.shippingCost} />} />
          <Row label="販売手数料" value={<Money value={-calc.sellingFee} />} />
          <Row label="その他経費" value={<Money value={-calc.otherCost} />} />
          <Row label="ROI" value={<Percent value={calc.roi} />} />
        </dl>
        {calc.hasSalePrice && (
          <div className="mt-3 rounded-xl bg-secondary px-3 py-2.5 text-sm">
            <span className="text-muted-foreground">利益¥{profile.recommend_min_profit.toLocaleString()}確保の上限仕入価格 </span>
            <Money value={calc.maxPurchasePrice} className="font-semibold" />
          </div>
        )}
      </div>

      {/* 画面下部に固定：リアルタイム利益 + 保存 */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-surface/90 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {sold ? "利益" : "見込み利益"}
              {calc.judgment && <JudgmentPill judgment={calc.judgment} />}
            </div>
            <div className="flex items-baseline gap-2">
              <Money value={calc.ready ? calc.profit : null} tone="auto" className="text-2xl font-bold" />
              <Percent value={calc.ready ? calc.margin : null} tone="auto" className="text-sm font-semibold" />
            </div>
          </div>
          <Button type="submit" size="xl" variant="brand" disabled={saving || imagesBusy} className="min-w-28">
            {saving && <Loader2 className="animate-spin" />}
            {isNew ? "登録する" : "保存する"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">{title}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-4 border-t px-4 pt-4 pb-5">{children}</div>}
    </section>
  );
}
