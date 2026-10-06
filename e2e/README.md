# E2E テスト

本物の Supabase を使わずに、ローカルの PostgreSQL 上で
「登録 → 利益計算 → 判定 → 保存 → 一覧 → 売却 → 月間利益 → 達成率」までをスマホ幅（390px）で通しテストします。

- `mock-supabase.cjs` … Supabase 互換のテストサーバー（認証 + PostgREST のサブセット）。
  クエリは本物のマイグレーション・RLS・トリガーの上で実行されます。Storage（画像）は対象外です。
- `flow.cjs` … Playwright によるブラウザ操作（各ステップで金額・達成率を検証し、スクリーンショットを保存）

## 実行手順

```bash
# 1. テスト用 DB を作成してマイグレーションを適用
createdb resell_e2e
psql -d resell_e2e -f supabase/tests/supabase_stub.sql -f supabase/migrations/20261006000000_initial_schema.sql

# 2. テストサーバーを起動（:54321）
PGDATABASE=resell_e2e node e2e/mock-supabase.cjs &

# 3. アプリをテストサーバー向けにビルドして起動
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npm run build
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=test npm start &

# 4. 実行（Chromium のパスは環境に合わせて指定。Playwright のブラウザがあれば不要）
CHROMIUM_PATH=/path/to/chrome npm run e2e   # → ✅ E2E PASSED
```

スクリーンショットは `e2e/screenshots/` に保存されます。
