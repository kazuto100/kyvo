"use client";

// 商品の保存・削除・売却などクライアントからの書き込み処理
// 利益・利益率・自動手数料は DB トリガーが最終的に計算して保存する

import { deleteProductImages } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import type { Brand, Product, ProductInput, ProductStatus, Store } from "@/lib/types";

function errorMessage(error: { message: string; code?: string }) {
  if (error.code === "23505") return "同じ名前が既に登録されています";
  if (error.code === "42501") return "権限がありません。再ログインしてください";
  if (/Failed to fetch|NetworkError/i.test(error.message)) return "通信エラーです。電波の良い場所で再度お試しください";
  return error.message;
}

export class ServiceError extends Error {}

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new ServiceError(errorMessage(res.error));
  if (res.data === null) throw new ServiceError("データが見つかりません");
  return res.data;
}

function checkOk(res: { error: { message: string; code?: string } | null }) {
  if (res.error) throw new ServiceError(errorMessage(res.error));
}

/** ブランド名 → id（無ければ作成） */
export async function ensureBrand(name: string, brands: Brand[]): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = brands.find((b) => b.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing.id;
  const supabase = createClient();
  const res = await supabase.from("brands").insert({ name: trimmed }).select("id").single();
  if (res.error?.code === "23505") {
    const again = await supabase.from("brands").select("id").eq("name", trimmed).single();
    return check(again).id;
  }
  return check(res).id;
}

export async function createStore(name: string, supplierId: string | null): Promise<Store> {
  const supabase = createClient();
  return check(
    await supabase.from("stores").insert({ name: name.trim(), supplier_id: supplierId }).select("*").single<Store>(),
  );
}

export async function saveProduct(input: ProductInput & { id: string }, isNew: boolean): Promise<Product> {
  const supabase = createClient();
  const { id, ...rest } = input;
  const payload = isNew ? { id, ...rest } : rest;
  const res = isNew
    ? await supabase.from("products").insert(payload).select("*").single<Product>()
    : await supabase.from("products").update(payload).eq("id", id).select("*").single<Product>();
  return check(res);
}

export async function updateProduct(id: string, patch: Partial<ProductInput>): Promise<Product> {
  const supabase = createClient();
  return check(await supabase.from("products").update(patch).eq("id", id).select("*").single<Product>());
}

export async function updateStatus(id: string, status: ProductStatus): Promise<Product> {
  const patch: Partial<ProductInput> = { status };
  // 売却前のステータスに戻した場合は売却情報をクリア
  if (status !== "sold" && status !== "shipped") {
    patch.sold_date = null;
    patch.actual_sale_price = null;
  }
  return updateProduct(id, patch);
}

export async function deleteProduct(product: Pick<Product, "id" | "image_urls">) {
  const supabase = createClient();
  checkOk(await supabase.from("products").delete().eq("id", product.id));
  await deleteProductImages(product.image_urls);
}

/** Product → 書き込み可能な列だけを抜き出す */
export function toProductInput(p: Product): ProductInput {
  return {
    name: p.name,
    brand_id: p.brand_id,
    category_id: p.category_id,
    condition: p.condition,
    image_urls: p.image_urls,
    memo: p.memo,
    supplier_id: p.supplier_id,
    purchase_store_id: p.purchase_store_id,
    purchase_date: p.purchase_date,
    purchase_price: p.purchase_price,
    other_purchase_cost: p.other_purchase_cost,
    selling_platform_id: p.selling_platform_id,
    expected_sale_price: p.expected_sale_price,
    actual_sale_price: p.actual_sale_price,
    listing_date: p.listing_date,
    sold_date: p.sold_date,
    listing_url: p.listing_url,
    status: p.status,
    shipping_cost: p.shipping_cost,
    selling_fee: p.selling_fee,
    selling_fee_auto: p.selling_fee_auto,
    other_cost: p.other_cost,
  };
}

/** 新規商品の既定値 */
export function emptyProductInput(today: string): ProductInput {
  return {
    name: "",
    brand_id: null,
    category_id: null,
    condition: null,
    image_urls: [],
    memo: null,
    supplier_id: null,
    purchase_store_id: null,
    purchase_date: today,
    purchase_price: 0,
    other_purchase_cost: 0,
    selling_platform_id: null,
    expected_sale_price: null,
    actual_sale_price: null,
    listing_date: null,
    sold_date: null,
    listing_url: null,
    status: "purchased",
    shipping_cost: 0,
    selling_fee: 0,
    selling_fee_auto: true,
    other_cost: 0,
  };
}
