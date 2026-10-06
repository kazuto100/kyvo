import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { ProductForm } from "@/components/products/product-form";
import { getMasterData, getProduct, requireUser, signImagePaths } from "@/lib/data";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "商品を編集" };

export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  const { id } = await params;
  const [user, master, product] = await Promise.all([requireUser(), getMasterData(), getProduct(id)]);
  if (!product) notFound();
  const signed = await signImagePaths(product.image_urls);
  const images = product.image_urls.map((path) => ({ path, url: signed[path] ?? "", isNew: false })).filter((i) => i.url);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="商品を編集" description={product.name} back={`/products/${product.id}`} />
      <ProductForm master={master} userId={user.id} today={todayISO()} product={product} initialImages={images} />
    </div>
  );
}
