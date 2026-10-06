import { ExternalLink, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Money, Percent } from "@/components/app/money";
import { StatusBadge } from "@/components/app/status-badge";
import { STOCK_ALERT_META, stockAlertLevel, stockDays, type AlertThresholds } from "@/lib/analytics";
import { isSold, isStock } from "@/lib/constants";
import { formatShortDate, formatYen } from "@/lib/format";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductThumb({ url, className }: { url?: string; className?: string }) {
  return (
    <div className={cn("relative size-16 shrink-0 overflow-hidden rounded-xl border bg-muted", className)}>
      {url ? (
        <Image src={url} alt="" fill sizes="80px" className="object-cover" unoptimized />
      ) : (
        <div className="flex size-full items-center justify-center">
          <ImageIcon className="size-5 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );
}

export function StockAlertBadge({ days, thresholds }: { days: number; thresholds: AlertThresholds }) {
  const level = stockAlertLevel(days, thresholds);
  if (level === "none") return null;
  const meta = STOCK_ALERT_META[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        level === "warning" && "bg-warn-soft text-warn",
        level !== "warning" && "bg-loss-soft text-loss",
      )}
    >
      {meta.emoji} {level === "warning" ? `${days}${meta.label}` : meta.label}
    </span>
  );
}

export function ProductRow({
  product,
  imageUrl,
  brandName,
  today,
  thresholds,
}: {
  product: Product;
  imageUrl?: string;
  brandName?: string;
  today: string;
  thresholds: AlertThresholds;
}) {
  const sold = isSold(product.status);
  const salePrice = product.actual_sale_price ?? product.expected_sale_price;
  const days = stockDays(product, today);
  return (
    <div className="relative flex gap-3 rounded-2xl border bg-card p-3 transition hover:bg-accent/40">
      <Link href={`/products/${product.id}`} className="absolute inset-0 z-0 rounded-2xl" aria-label={product.name} />
      <ProductThumb url={imageUrl} />
      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-snug font-semibold">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {brandName ? `${brandName} · ` : ""}仕入 {formatShortDate(product.purchase_date)}
              {sold && product.sold_date ? ` · 売却 ${formatShortDate(product.sold_date)}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <Money value={product.profit} tone="auto" className="block text-base font-bold" />
            <Percent value={product.profit_margin} className="block text-[11px] text-muted-foreground" />
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <StatusBadge status={product.status} />
            {isStock(product.status) && <StockAlertBadge days={days} thresholds={thresholds} />}
            {!sold && product.profit !== null && <span className="text-[10px] text-muted-foreground">見込み</span>}
          </div>
          <div className="num shrink-0 text-xs text-muted-foreground">
            {formatYen(product.purchase_price)} → {salePrice ? formatYen(salePrice) : "未定"}
          </div>
        </div>
      </div>
      {product.listing_url && (
        <a
          href={product.listing_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 -mr-1 flex size-8 shrink-0 items-center justify-center self-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="出品ページを開く"
        >
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  );
}
