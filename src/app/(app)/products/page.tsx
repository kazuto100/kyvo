import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { ProductList } from "@/components/products/product-list";
import { Button } from "@/components/ui/button";
import { getMasterData, getProducts } from "@/lib/data";
import { todayISO } from "@/lib/format";
import type { StatusFilter } from "@/lib/product-filter";
import { PRODUCT_STATUSES } from "@/lib/types";

export const metadata: Metadata = { title: "商品一覧" };

const STATUS_PARAMS: StatusFilter[] = ["all", "stock", "sold", ...PRODUCT_STATUSES];

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const status = STATUS_PARAMS.find((s) => s === sp.status);
  const [master, products] = await Promise.all([getMasterData(), getProducts()]);
  return (
    <div>
      <PageHeader
        title="商品一覧"
        showSettings
        actions={
          <Button variant="brand" size="sm" className="h-9" asChild>
            <Link href="/products/new">
              <Plus />
              商品を登録
            </Link>
          </Button>
        }
      />
      <ProductList products={products} master={master} today={todayISO()} initialStatus={status} />
    </div>
  );
}
