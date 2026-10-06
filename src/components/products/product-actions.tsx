"use client";

import { BadgeJapaneseYen, ExternalLink, Loader2, MoreHorizontal, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isSold, STATUS_META } from "@/lib/constants";
import { deleteProduct, updateStatus } from "@/lib/product-service";
import { PRODUCT_STATUSES, type MasterData, type Product, type ProductStatus } from "@/lib/types";
import { SellDialog } from "./sell-dialog";

export function ProductActions({ product, master, today }: { product: Product; master: MasterData; today: string }) {
  const router = useRouter();
  const [sellOpen, setSellOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sold = isSold(product.status);

  async function changeStatus(status: ProductStatus) {
    if (status === product.status) return;
    if (isSold(status) && !sold) {
      setSellOpen(true);
      return;
    }
    setBusy(true);
    try {
      await updateStatus(product.id, status);
      toast.success(`ステータスを「${STATUS_META[status].label}」にしました`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteProduct(product);
      toast.success("商品を削除しました");
      router.replace("/products");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "削除に失敗しました");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        {sold ? (
          <Button variant="outline" size="lg" onClick={() => setSellOpen(true)}>
            <BadgeJapaneseYen />
            売却情報を修正
          </Button>
        ) : (
          <Button variant="brand" size="lg" onClick={() => setSellOpen(true)}>
            <BadgeJapaneseYen />
            売却を登録
          </Button>
        )}
        <Button variant="outline" size="lg" asChild>
          <Link href={`/products/${product.id}/edit`}>
            <SquarePen />
            編集
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="lg" className="w-12 px-0" aria-label="その他の操作" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>ステータスを変更</DropdownMenuLabel>
            {PRODUCT_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onSelect={() => void changeStatus(s)} disabled={s === product.status}>
                {STATUS_META[s].label}
                {s === product.status && <span className="ml-auto text-xs text-muted-foreground">現在</span>}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {product.listing_url && (
        <Button variant="secondary" size="lg" className="mt-2 w-full" asChild>
          <a href={product.listing_url} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            出品ページを開く
          </a>
        </Button>
      )}

      {sellOpen && <SellDialog product={product} master={master} today={today} open={sellOpen} onOpenChange={setSellOpen} />}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>商品を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{product.name}」と画像を削除します。売上・利益の集計からも外れます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void onDelete()}>
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
