import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-5xl font-bold text-muted-foreground/40">404</p>
      <p className="mt-3 font-semibold">ページが見つかりません</p>
      <p className="mt-1 text-sm text-muted-foreground">削除された商品の可能性があります。</p>
      <Button className="mt-5" asChild>
        <Link href="/products">商品一覧へ</Link>
      </Button>
    </div>
  );
}
