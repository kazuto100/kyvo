"use client";

import { Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAUTH_PROVIDERS } from "@/config/auth";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "メールアドレスまたはパスワードが正しくありません",
  "Email not confirmed": "メールアドレスの確認が完了していません。届いたメールのリンクを開いてください",
  "User already registered": "このメールアドレスは既に登録されています",
  "Password should be at least 6 characters.": "パスワードは6文字以上にしてください",
  auth_callback_failed: "認証リンクが無効か期限切れです。もう一度お試しください",
};

const translate = (msg: string) => ERROR_MESSAGES[msg] ?? msg;

export function AuthForm({ mode, next, initialError }: { mode: "login" | "signup"; next: string; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ? translate(initialError) : null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8 && mode === "signup") {
      setError("パスワードは8文字以上にしてください");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setSentTo(email);
        }
      }
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : "エラーが発生しました"));
    } finally {
      setLoading(false);
    }
  }

  async function onOAuth(provider: (typeof OAUTH_PROVIDERS)[number]["id"]) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(translate(error.message));
  }

  if (sentTo) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <MailCheck className="size-10 text-profit" />
          <p className="font-semibold">確認メールを送信しました</p>
          <p className="text-sm text-muted-foreground">
            {sentTo} に届いたリンクを開くと登録が完了します。
          </p>
          <Button variant="outline" className="mt-2" asChild>
            <Link href="/login">ログイン画面へ</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const providers = OAUTH_PROVIDERS.filter((p) => p.enabled);

  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "8文字以上" : ""}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-loss-soft px-3 py-2.5 text-sm text-loss">
              {error}
            </p>
          )}
          <Button type="submit" size="xl" className="w-full" disabled={loading || !email || !password}>
            {loading && <Loader2 className="animate-spin" />}
            {mode === "login" ? "ログイン" : "アカウントを作成"}
          </Button>
        </form>

        {providers.length > 0 && (
          <div className="space-y-2">
            {providers.map((p) => (
              <Button key={p.id} variant="outline" size="lg" className="w-full" onClick={() => onOAuth(p.id)}>
                {p.label}
              </Button>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              アカウントをお持ちでない方は{" "}
              <Link href="/signup" className="font-medium text-brand">
                新規登録
              </Link>
            </>
          ) : (
            <>
              登録済みの方は{" "}
              <Link href="/login" className="font-medium text-brand">
                ログイン
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
