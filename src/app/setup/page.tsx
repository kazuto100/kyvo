import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "セットアップ" };

export default async function SetupPage() {
  await connection();
  if (getSupabaseEnv()) redirect("/");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">{APP_CONFIG.name} のセットアップ</h1>
      <p className="mt-2 text-sm text-muted-foreground">Supabase の接続情報が設定されていません。</p>
      <Card className="mt-6">
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <ol className="list-decimal space-y-3 pl-5">
            <li>Supabase でプロジェクトを作成します。</li>
            <li>
              SQL Editor で <code className="rounded bg-muted px-1.5 py-0.5">supabase/migrations/</code>{" "}
              内の SQL を実行します（テーブル・RLS・Storage が作成されます）。
            </li>
            <li>
              <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code> を{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code> にコピーし、URL と
              Publishable(anon) キーを設定します。
            </li>
            <li>開発サーバーを再起動します。</li>
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
