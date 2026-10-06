import type { Provider } from "@supabase/supabase-js";

// 将来の OAuth ログイン（Google 等）はここで enabled: true にするだけで表示される
// （Supabase ダッシュボード側で該当プロバイダーの有効化が必要）
export const OAUTH_PROVIDERS: { id: Provider; label: string; enabled: boolean }[] = [
  { id: "google", label: "Google でログイン", enabled: false },
];
