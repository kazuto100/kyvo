import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";

export async function createClient() {
  // cookies() を先に呼んでリクエスト時レンダリングにする（ビルド時に静的生成しない）
  const cookieStore = await cookies();
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase の環境変数が設定されていません");
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component からは cookie を書けない。proxy がセッションを更新する
        }
      },
    },
  });
}
