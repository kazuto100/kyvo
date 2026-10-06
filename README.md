# RESELL — 中古せどり 利益・在庫・販売管理

> 仕入れ判断から販売・利益管理まで、これ1つ。

店舗で商品を見つけた瞬間に「買うべきか・いくらまで出せるか」を判断し、
月利益 100 万円を目指すための経営ダッシュボードです。スマホ（片手操作）最優先・PWA 対応。

## 技術スタック

Next.js 16 (App Router) / TypeScript / Tailwind CSS v4 / shadcn/ui（Radix）/ Supabase（Auth・PostgreSQL・Storage）/ Recharts / Lucide

## セットアップ

1. Supabase でプロジェクトを作成
2. SQL Editor で `supabase/migrations/20261006000000_initial_schema.sql` を実行
   （Supabase CLI を使う場合は `supabase db push`）
   - テーブル・RLS・トリガー・Storage バケット `product-images` が作成されます
   - 新規ユーザー登録時に販売先（メルカリ10%等）・カテゴリ・仕入先・送料テンプレートが自動作成されます
3. 環境変数を設定
   ```bash
   cp .env.example .env.local
   # NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY を記入
   ```
4. 起動
   ```bash
   npm install
   npm run dev        # http://localhost:3000
   ```
5. Supabase の Authentication > URL Configuration で Site URL と
   Redirect URL（`https://<your-domain>/auth/callback`）を設定
   （メール確認を有効にしている場合に必要）

スマホでは「ホーム画面に追加」でアプリとして使えます。圏外ではオフライン画面を表示します
（Service Worker は本番ビルドのみ有効。ログイン後のデータはキャッシュしません）。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm run typecheck` | 型チェック |
| `npm test` | 利益計算・集計ロジックのユニットテスト（Vitest） |
| `npm run check` | lint + 型チェック + ユニットテスト |
| `npm run e2e` | スマホ幅のブラウザ通しテスト（準備手順は [`e2e/README.md`](e2e/README.md)） |

GitHub Actions（`.github/workflows/ci.yml`）で、PR ごとに lint・型チェック・テスト・ビルドと
PostgreSQL 16 上のスキーマ／RLS テストが実行されます。

DB スキーマの検証（ローカル Postgres、任意）:

```bash
createdb resell_test
psql -d resell_test -f supabase/tests/supabase_stub.sql \
  -f supabase/migrations/20261006000000_initial_schema.sql \
  -f supabase/tests/schema_test.sql   # → ALL SCHEMA TESTS PASSED
```

## 主な機能

- **ダッシュボード**: 今日の利益 / 今月の利益・利益率 / 月利益目標の達成率・残り金額・「あと何個売れば達成か」/ 売上・仕入れ・送料・手数料・経費の内訳 / KPI / 長期在庫アラート
- **仕入れ判断（シミュレーター）**: 想定利益・利益率・ROI をリアルタイム計算、🔥おすすめ / ⚠️要検討 / ❌見送り 判定、**最大仕入価格**（目標利益ベース・🔥基準ベース）、過去データ分析（β）
- **クイック仕入れ**: 商品名・仕入価格・想定販売価格・送料・販売先の5項目で登録 → 結果表示
- **商品登録・編集・削除**: 画像最大10枚（自動圧縮・Supabase Storage）、ブランド/店舗はその場で追加、手数料は販売先から自動計算（手入力も可）
- **売却登録**: 販売価格・販売日・送料を入れると利益確定 → 月間利益・目標達成率に反映
- **商品一覧**: 高速検索（商品名・ブランド・店舗・カテゴリ）、絞り込み、並び替え、カード/テーブル表示、出品ページを開く、CSV 書き出し
- **在庫**: 在庫数・原価・想定売上・想定利益、在庫期間の分布、⚠️30日 / 🔴60日 / 🚨90日 アラート
- **分析**: 月別（グラフ＋表）、年間、利益額/利益率/売上 TOP10、仕入先・店舗・ブランド・カテゴリ・販売先別
- **経費**: 梱包資材・交通費など商品に紐づかない経費（月間利益から差し引き）
- **設定**: 月利益目標（既定値＋月別）、判定基準、アラート日数、販売先の手数料率/固定額、送料テンプレート、カテゴリ・ブランド・仕入先・店舗、CSV 入出力、ライト/ダーク
- **認証**: メール＋パスワード（`src/config/auth.ts` で Google 等を追加可能）

## 計算の定義

```
利益     = 販売価格 − 仕入価格 − その他仕入経費 − 送料 − 販売手数料 − その他経費
利益率   = 利益 ÷ 販売価格 × 100      （売上に対する利益率）
ROI      = 利益 ÷ 仕入原価 × 100
手数料   = floor(販売価格 × 料率 ÷ 100) + 固定額
最大仕入価格 = 販売価格 − 送料 − 手数料 − その他経費 − 目標利益
```

- 売却前は「確定販売価格 → 想定販売価格」の順で見込み利益を計算します。
- 計算はフロント（`src/lib/profit.ts`）でリアルタイムに行い、保存時は DB トリガー
  （`products_compute`）が同じ式で再計算して保存します。販売先の手数料率を変更すると
  未売却商品の見込み利益も自動で再計算されます（売却済みの確定値は変わりません）。
- 月間の売上・利益は**販売日**で計上します。

## 構成

```
src/
  app/(auth)/        ログイン・新規登録
  app/(app)/         ダッシュボード・商品・判定・分析・在庫・経費・設定
  components/        ui/（shadcn/ui）, app/（共通）, 各機能
  config/            アプリ名・認証プロバイダー（ブランディングはここで変更）
  hooks/             useProfitCalc（リアルタイム計算）
  lib/               profit（計算）, analytics（集計）, product-filter, csv, data（サーバー取得）,
                     product-service（書き込み）, ai/advisor（AI判定の差し替えポイント）
  proxy.ts           認証ガード（Next.js 16 の Proxy）
supabase/
  migrations/        スキーマ・RLS・トリガー・Storage
  tests/             スキーマ検証 SQL
```

## 将来拡張のための設計

- 販売先は `platforms.kind`（flea_market / auction / marketplace / ec）で Amazon・楽天・Shopify 等を追加可能
- `sales` テーブルは売却台帳（トリガーで自動同期）。複数数量販売・会計連携の土台
- 商品一覧・在庫は60件ずつ表示し、画像の署名付き URL は表示中の分だけブラウザで取得（件数が増えても重くならない）
- 店舗に住所・緯度経度を保持（Google Maps 連携・巡回ルート用）
- `lib/ai/advisor.ts` の `PurchaseAdvisor` インターフェースを実装すれば AI 判定・相場取得に差し替え可能
- アプリ名は `NEXT_PUBLIC_APP_NAME` で変更可能
