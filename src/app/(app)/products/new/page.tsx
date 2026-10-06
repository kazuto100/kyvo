import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { EntryModeTabs } from "@/components/products/entry-mode-tabs";
import { ProductForm } from "@/components/products/product-form";
import { getMasterData, getProduct, requireUser } from "@/lib/data";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "商品を登録" };

export default async function NewProductPage({ searchParams }: PageProps<"/products/new">) {
  const { from } = await searchParams;
  const [user, master, template] = await Promise.all([
    requireUser(),
    getMasterData(),
    typeof from === "string" ? getProduct(from) : null,
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={template ? "複製して登録" : "商品を登録"}
        description={template ? `「${template.name}」の内容をコピーしました` : undefined}
        back={template ? `/products/${template.id}` : "/products"}
      />
      {!template && <EntryModeTabs active="full" />}
      <ProductForm master={master} userId={user.id} today={todayISO()} template={template ?? undefined} />
    </div>
  );
}
