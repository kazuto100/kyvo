import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { EntryModeTabs } from "@/components/products/entry-mode-tabs";
import { ProductForm } from "@/components/products/product-form";
import { getMasterData, requireUser } from "@/lib/data";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "商品を登録" };

export default async function NewProductPage() {
  const [user, master] = await Promise.all([requireUser(), getMasterData()]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="商品を登録" back="/products" />
      <EntryModeTabs active="full" />
      <ProductForm master={master} userId={user.id} today={todayISO()} />
    </div>
  );
}
