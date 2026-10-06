import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { APP_CONFIG } from "@/config/app";
import { createClient } from "@/lib/supabase/server";
import type {
  Brand,
  Category,
  Expense,
  MasterData,
  MonthlyGoal,
  Platform,
  Product,
  Profile,
  ShippingTemplate,
  Store,
  Supplier,
} from "@/lib/types";

const PAGE_SIZE = 1000;

/** ログインユーザー（未ログインなら /login へ） */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return { id: data.claims.sub as string, email: (data.claims.email as string | undefined) ?? "" };
});

async function fetchAll<T>(
  table: string,
  build: (q: ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>) => unknown,
): Promise<T[]> {
  const supabase = await createClient();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = build(supabase.from(table)) as any;
    const { data, error } = await q.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table} の取得に失敗しました: ${error.message}`);
    rows.push(...(data as T[]));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export const getMasterData = cache(async (): Promise<MasterData> => {
  await requireUser();
  const supabase = await createClient();

  let { data: profile } = await supabase.from("profiles").select("*").maybeSingle<Profile>();
  if (!profile) {
    // トリガー導入前のユーザー向けに初期データを作成
    const { error } = await supabase.rpc("ensure_user_defaults");
    if (error) throw new Error(`初期データの作成に失敗しました: ${error.message}`);
    ({ data: profile } = await supabase.from("profiles").select("*").maybeSingle<Profile>());
    if (!profile) throw new Error("プロフィールを取得できませんでした");
  }

  const [platforms, suppliers, stores, brands, categories, shippingTemplates] = await Promise.all([
    fetchAll<Platform>("platforms", (q) => q.select("*").order("sort_order").order("created_at")),
    fetchAll<Supplier>("suppliers", (q) => q.select("*").order("sort_order").order("name")),
    fetchAll<Store>("stores", (q) => q.select("*").order("name")),
    fetchAll<Brand>("brands", (q) => q.select("*").order("name")),
    fetchAll<Category>("categories", (q) => q.select("*").order("sort_order").order("name")),
    fetchAll<ShippingTemplate>("shipping_templates", (q) => q.select("*").order("sort_order").order("cost")),
  ]);

  return {
    profile: {
      ...profile,
      recommend_min_margin: Number(profile.recommend_min_margin),
      consider_min_margin: Number(profile.consider_min_margin),
    },
    platforms: platforms.map((p) => ({ ...p, fee_rate: Number(p.fee_rate) })),
    suppliers,
    stores,
    brands,
    categories,
    shippingTemplates,
  };
});

const normalizeProduct = (p: Product): Product => ({
  ...p,
  image_urls: p.image_urls ?? [],
  profit_margin: p.profit_margin === null ? null : Number(p.profit_margin),
  roi: p.roi === null ? null : Number(p.roi),
});

export const getProducts = cache(async (): Promise<Product[]> => {
  await requireUser();
  const rows = await fetchAll<Product>("products", (q) =>
    q.select("*").order("purchase_date", { ascending: false }).order("created_at", { ascending: false }),
  );
  return rows.map(normalizeProduct);
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getProduct = cache(async (id: string): Promise<Product | null> => {
  await requireUser();
  if (!UUID_RE.test(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle<Product>();
  if (error) throw new Error(`商品の取得に失敗しました: ${error.message}`);
  return data ? normalizeProduct(data) : null;
});

export const getExpenses = cache(async (): Promise<Expense[]> => {
  await requireUser();
  return fetchAll<Expense>("expenses", (q) =>
    q.select("*").order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
  );
});

export const getMonthlyGoals = cache(async (): Promise<MonthlyGoal[]> => {
  await requireUser();
  return fetchAll<MonthlyGoal>("monthly_goals", (q) => q.select("*").order("month"));
});

/** 指定月 (YYYY-MM) の利益目標 */
export function resolveGoal(goals: MonthlyGoal[], profile: Profile, month: string): number {
  return goals.find((g) => g.month.startsWith(month))?.goal_profit ?? profile.default_monthly_goal;
}

/** Storage パス → 署名付き URL（1時間） */
export async function signImagePaths(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const result: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const { data } = await supabase.storage.from(APP_CONFIG.imageBucket).createSignedUrls(chunk, 3600);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) result[item.path] = item.signedUrl;
    }
  }
  return result;
}
