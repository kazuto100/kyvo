"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (client) return client;
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase の環境変数が設定されていません");
  client = createBrowserClient(env.url, env.key);
  return client;
}
