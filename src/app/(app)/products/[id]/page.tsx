import { ImageIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { JudgmentBanner } from "@/components/app/judgment";
import { Money, Percent } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { ProductActions } from "@/components/products/product-actions";
import { StockAlertBadge } from "@/components/products/product-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stockDays } from "@/lib/analytics";
import { isSold, isStock } from "@/lib/constants";
import { getMasterData, getProduct, signImagePaths } from "@/lib/data";
import { formatDate, formatYen, todayISO } from "@/lib/format";
import { calcMaxPurchasePrice, judgePurchase } from "@/lib/profit";

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  return { title: product?.name ?? "商品" };
}

export default async function ProductDetailPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const [master, product] = await Promise.all([getMasterData(), getProduct(id)]);
  if (!product) notFound();

  const signed = await signImagePaths(product.image_urls);
  const today = todayISO();
  const sold = isSold(product.status);
  const salePrice = product.actual_sale_price ?? product.expected_sale_price;
  const nameOf = <T extends { id: string; name: string }>(list: T[], id: string | null) =>
    list.find((x) => x.id === id)?.name ?? "—";
  const judgment =
    product.profit !== null ? judgePurchase(product.profit, product.profit_margin, master.profile) : null;
  const maxPurchase = salePrice
    ? calcMaxPurchasePrice({
        salePrice,
        shippingCost: product.shipping_cost,
        sellingFee: product.selling_fee,
        otherCost: product.other_cost,
        otherPurchaseCost: product.other_purchase_cost,
        targetProfit: master.profile.recommend_min_profit,
      })
    : null;
  const days = stockDays(product, today);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={product.status} />
            {isStock(product.status) && (
              <>
                <span className="text-xs">在庫 {days}日</span>
                <StockAlertBadge days={days} thresholds={master.profile} />
              </>
            )}
          </span>
        }
        back="/products"
      />

      {product.image_urls.length > 0 ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          {product.image_urls.map((path, i) => (
            <div key={path} className="relative aspect-square w-[78%] shrink-0 snap-center overflow-hidden rounded-2xl border bg-muted sm:w-64">
              {signed[path] && (
                <Image src={signed[path]} alt={`${product.name} ${i + 1}`} fill sizes="(min-width: 640px) 256px, 78vw" className="object-cover" unoptimized priority={i === 0} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-28 items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground">
          <ImageIcon className="size-5" />
          画像なし
        </div>
      )}

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">{sold ? "利益（確定）" : "見込み利益"}</div>
              <Money value={product.profit} tone="auto" className="text-4xl font-bold tracking-tight" />
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">利益率</div>
              <Percent value={product.profit_margin} tone="auto" digits={2} className="text-2xl font-bold" />
            </div>
          </div>
          {!sold && <JudgmentBanner judgment={judgment} />}
          <ProductActions product={product} master={master} today={today} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>利益の内訳</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label={sold ? "販売価格" : "想定販売価格"} value={<Money value={salePrice} />} />
              <Row label="仕入価格" value={<Money value={-product.purchase_price} />} />
              {product.other_purchase_cost > 0 && <Row label="その他仕入経費" value={<Money value={-product.other_purchase_cost} />} />}
              <Row label="送料" value={<Money value={-product.shipping_cost} />} />
              <Row
                label={`販売手数料${product.selling_fee_auto ? "（自動）" : ""}`}
                value={<Money value={-product.selling_fee} />}
              />
              <Row label="その他経費" value={<Money value={-product.other_cost} />} />
              <div className="border-t pt-2" />
              <Row label="利益" value={<Money value={product.profit} tone="auto" className="font-bold" />} />
              <Row label="ROI" value={<Percent value={product.roi} />} />
              {!sold && maxPurchase !== null && (
                <Row label={`上限仕入価格（利益${formatYen(master.profile.recommend_min_profit)}）`} value={<Money value={maxPurchase} />} />
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>商品・仕入・販売情報</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="ブランド" value={nameOf(master.brands, product.brand_id)} />
              <Row label="カテゴリ" value={nameOf(master.categories, product.category_id)} />
              <Row label="状態" value={product.condition ?? "—"} />
              <Row label="仕入先" value={nameOf(master.suppliers, product.supplier_id)} />
              <Row label="仕入店舗" value={nameOf(master.stores, product.purchase_store_id)} />
              <Row label="仕入日" value={formatDate(product.purchase_date)} />
              <Row label="販売先" value={nameOf(master.platforms, product.selling_platform_id)} />
              <Row label="出品日" value={formatDate(product.listing_date)} />
              <Row label="販売日" value={formatDate(product.sold_date)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {product.memo && (
        <Card>
          <CardHeader>
            <CardTitle>メモ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{product.memo}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="num truncate text-right">{value}</dd>
    </div>
  );
}
