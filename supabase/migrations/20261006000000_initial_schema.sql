-- =============================================================================
-- RESELL — 中古せどり 利益・在庫・販売管理  初期スキーマ
--
-- 設計方針
--   * すべてのユーザーデータは user_id を持ち、RLS で本人のみアクセス可能
--   * 利益・利益率・ROI・自動手数料は DB トリガーでも計算する
--     （フロントのリアルタイム計算と同じ式。保存値は常に DB が正）
--   * 販売先の手数料率が変わったら、未売却商品の自動手数料・利益を再計算
--   * sales は売却台帳。products の売却状態からトリガーで同期する
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 共通
-- -----------------------------------------------------------------------------
create type public.product_status as enum (
  'purchased',  -- 仕入れ済み
  'preparing',  -- 出品準備中
  'listed',     -- 出品中
  'sold',       -- 売却済み
  'shipped',    -- 発送済み
  'returned',   -- 返品
  'on_hold'     -- 保留
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 日本時間の「今日」
create or replace function public.today_jst()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Tokyo')::date;
$$;

-- -----------------------------------------------------------------------------
-- profiles（= users。auth.users と 1:1 のユーザー設定）
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- 月利益目標（monthly_goals に該当月が無い場合の既定値）
  default_monthly_goal integer not null default 1000000 check (default_monthly_goal >= 0),
  -- 仕入れ判断基準
  recommend_min_profit integer not null default 5000,
  recommend_min_margin numeric(5, 2) not null default 30,
  consider_min_profit integer not null default 3000,
  consider_min_margin numeric(5, 2) not null default 20,
  -- 長期在庫アラート（日）
  stock_alert_days_warning integer not null default 30,
  stock_alert_days_markdown integer not null default 60,
  stock_alert_days_dispose integer not null default 90,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- マスタ
-- -----------------------------------------------------------------------------
-- 販売先（メルカリ・Yahoo!フリマ等）。将来 Amazon / 楽天 / Shopify も kind で拡張
create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  kind text not null default 'flea_market', -- flea_market | auction | marketplace | ec | other
  fee_rate numeric(5, 2) not null default 0 check (fee_rate >= 0 and fee_rate <= 100),
  fee_fixed integer not null default 0 check (fee_fixed >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

-- 仕入先（セカンドストリート・ブックオフ等のチェーン/サービス）
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- 仕入店舗（セカンドストリート多治見店 等）。将来の巡回ルート用に住所・座標を保持
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  address text,
  latitude double precision,
  longitude double precision,
  memo text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.shipping_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  cost integer not null default 0 check (cost >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 月ごとの利益目標（無い月は profiles.default_monthly_goal）
create table public.monthly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  goal_profit integer not null check (goal_profit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create trigger monthly_goals_updated_at
  before update on public.monthly_goals
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,

  -- 商品情報
  name text not null check (char_length(name) between 1 and 200),
  brand_id uuid references public.brands (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  condition text,
  image_urls text[] not null default '{}' check (coalesce(array_length(image_urls, 1), 0) <= 10),
  memo text,

  -- 仕入情報
  supplier_id uuid references public.suppliers (id) on delete set null,
  purchase_store_id uuid references public.stores (id) on delete set null,
  purchase_date date not null default public.today_jst(),
  purchase_price integer not null default 0 check (purchase_price >= 0),
  other_purchase_cost integer not null default 0 check (other_purchase_cost >= 0),

  -- 販売情報
  selling_platform_id uuid references public.platforms (id) on delete set null,
  expected_sale_price integer check (expected_sale_price >= 0),
  actual_sale_price integer check (actual_sale_price >= 0),
  listing_date date,
  sold_date date,
  listing_url text check (listing_url is null or listing_url ~* '^https?://'),
  status public.product_status not null default 'purchased',

  -- 費用
  shipping_cost integer not null default 0 check (shipping_cost >= 0),
  selling_fee integer not null default 0 check (selling_fee >= 0),
  selling_fee_auto boolean not null default true, -- true: 販売先の手数料率から自動計算
  other_cost integer not null default 0 check (other_cost >= 0),

  -- 計算列（トリガーで算出。売却前は想定販売価格ベースの見込み値）
  profit integer,
  profit_margin numeric(9, 2), -- 利益 ÷ 販売価格 × 100
  roi numeric(9, 2),           -- 利益 ÷ 仕入原価 × 100（将来用）

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_user_status_idx on public.products (user_id, status);
create index products_user_sold_date_idx on public.products (user_id, sold_date);
create index products_user_purchase_date_idx on public.products (user_id, purchase_date);

-- 手数料計算: floor(販売価格 × 料率 / 100) + 固定額
create or replace function public.calc_selling_fee(
  p_price integer, p_rate numeric, p_fixed integer
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_price is null or p_price <= 0 then 0
    else floor(p_price * coalesce(p_rate, 0) / 100)::integer + coalesce(p_fixed, 0)
  end;
$$;

create or replace function public.products_compute()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_price integer;
  v_rate numeric;
  v_fixed integer;
  v_cost integer;
begin
  -- 売却/発送済みになったら販売日・販売価格を補完
  if new.status in ('sold', 'shipped') then
    if new.sold_date is null then
      new.sold_date := public.today_jst();
    end if;
    if new.actual_sale_price is null then
      new.actual_sale_price := new.expected_sale_price;
    end if;
  end if;
  if new.status = 'listed' and new.listing_date is null then
    new.listing_date := public.today_jst();
  end if;

  v_price := coalesce(new.actual_sale_price, new.expected_sale_price);

  -- 販売先が削除された（FK で NULL 化）売却済み商品は、確定済みの手数料を維持する
  if tg_op = 'UPDATE' and new.selling_fee_auto
     and new.status in ('sold', 'shipped')
     and old.selling_platform_id is not null and new.selling_platform_id is null
     and new.actual_sale_price is not distinct from old.actual_sale_price then
    new.selling_fee_auto := false;
    new.selling_fee := old.selling_fee;
  end if;

  if new.selling_fee_auto then
    if new.selling_platform_id is not null then
      select p.fee_rate, p.fee_fixed into v_rate, v_fixed
      from public.platforms p
      where p.id = new.selling_platform_id and p.user_id = new.user_id;
    end if;
    new.selling_fee := public.calc_selling_fee(v_price, v_rate, v_fixed);
  end if;

  v_cost := new.purchase_price + new.other_purchase_cost;

  if v_price is null then
    new.profit := null;
    new.profit_margin := null;
    new.roi := null;
  else
    new.profit := v_price - v_cost - new.shipping_cost - new.selling_fee - new.other_cost;
    new.profit_margin := case when v_price > 0
      then round(new.profit::numeric * 100 / v_price, 2) end;
    new.roi := case when v_cost > 0
      then round(new.profit::numeric * 100 / v_cost, 2) end;
  end if;

  return new;
end;
$$;

-- 参照先（ブランド・カテゴリ・仕入先・店舗・販売先）が本人のデータかを検証
-- （外部キー制約は RLS を経由しないため、他ユーザーの ID を参照できないようにする）
create or replace function public.products_check_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.brand_id is not null and not exists (
        select 1 from public.brands where id = new.brand_id and user_id = new.user_id))
     or (new.category_id is not null and not exists (
        select 1 from public.categories where id = new.category_id and user_id = new.user_id))
     or (new.supplier_id is not null and not exists (
        select 1 from public.suppliers where id = new.supplier_id and user_id = new.user_id))
     or (new.purchase_store_id is not null and not exists (
        select 1 from public.stores where id = new.purchase_store_id and user_id = new.user_id))
     or (new.selling_platform_id is not null and not exists (
        select 1 from public.platforms where id = new.selling_platform_id and user_id = new.user_id))
  then
    raise exception 'referenced master data does not belong to the user'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger products_check_ownership
  before insert or update of brand_id, category_id, supplier_id, purchase_store_id, selling_platform_id, user_id
  on public.products
  for each row execute function public.products_check_ownership();

create or replace function public.stores_check_ownership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.supplier_id is not null and not exists (
       select 1 from public.suppliers where id = new.supplier_id and user_id = new.user_id) then
    raise exception 'referenced supplier does not belong to the user' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger stores_check_ownership
  before insert or update of supplier_id, user_id on public.stores
  for each row execute function public.stores_check_ownership();

create trigger products_compute
  before insert or update on public.products
  for each row execute function public.products_compute();

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- 販売先の手数料が変わったら、未売却の自動手数料商品を再計算
create or replace function public.platforms_recalc_products()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.fee_rate is distinct from old.fee_rate
     or new.fee_fixed is distinct from old.fee_fixed then
    update public.products
      set selling_fee_auto = true -- 値は変えずに products_compute を再実行させる
      where selling_platform_id = new.id
        and user_id = new.user_id
        and selling_fee_auto
        and status not in ('sold', 'shipped');
  end if;
  return new;
end;
$$;

create trigger platforms_recalc_products
  after update on public.platforms
  for each row execute function public.platforms_recalc_products();

create trigger platforms_updated_at
  before update on public.platforms
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- sales（売却台帳。products から自動同期）
-- -----------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null unique references public.products (id) on delete cascade,
  platform_id uuid references public.platforms (id) on delete set null,
  sold_date date not null,
  sale_price integer not null,
  cost_of_goods integer not null,
  shipping_cost integer not null,
  selling_fee integer not null,
  other_cost integer not null,
  profit integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sales_user_sold_date_idx on public.sales (user_id, sold_date);

create or replace function public.products_sync_sales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('sold', 'shipped') and new.actual_sale_price is not null then
    insert into public.sales as s (
      user_id, product_id, platform_id, sold_date, sale_price, cost_of_goods,
      shipping_cost, selling_fee, other_cost, profit
    ) values (
      new.user_id, new.id, new.selling_platform_id, new.sold_date, new.actual_sale_price,
      new.purchase_price + new.other_purchase_cost,
      new.shipping_cost, new.selling_fee, new.other_cost, new.profit
    )
    on conflict (product_id) do update set
      platform_id = excluded.platform_id,
      sold_date = excluded.sold_date,
      sale_price = excluded.sale_price,
      cost_of_goods = excluded.cost_of_goods,
      shipping_cost = excluded.shipping_cost,
      selling_fee = excluded.selling_fee,
      other_cost = excluded.other_cost,
      profit = excluded.profit,
      updated_at = now();
  else
    delete from public.sales where product_id = new.id;
  end if;
  return null;
end;
$$;

create trigger products_sync_sales
  after insert or update on public.products
  for each row execute function public.products_sync_sales();

-- -----------------------------------------------------------------------------
-- expenses（商品に紐づかない経費：梱包資材・交通費など）
-- -----------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expense_date date not null default public.today_jst(),
  category text not null default 'その他',
  amount integer not null check (amount >= 0),
  memo text,
  created_at timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, expense_date);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platforms enable row level security;
alter table public.suppliers enable row level security;
alter table public.stores enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.shipping_templates enable row level security;
alter table public.monthly_goals enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;

create policy "profiles: own row select" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: own row update" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- sales はトリガーのみが書き込む（閲覧のみ許可）
create policy "sales: own rows select" on public.sales
  for select to authenticated using (user_id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'platforms', 'suppliers', 'stores', 'brands', 'categories',
    'shipping_templates', 'monthly_goals', 'products', 'expenses'
  ] loop
    execute format(
      'create policy "%1$s: own rows" on public.%1$I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 新規ユーザーの初期データ
-- -----------------------------------------------------------------------------
create or replace function public.seed_user_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (p_user_id) on conflict (id) do nothing;

  if not exists (select 1 from public.platforms where user_id = p_user_id) then
    insert into public.platforms (user_id, name, kind, fee_rate, fee_fixed, sort_order) values
      (p_user_id, 'メルカリ', 'flea_market', 10, 0, 1),
      (p_user_id, 'Yahoo!フリマ', 'flea_market', 5, 0, 2),
      (p_user_id, 'ヤフオク', 'auction', 10, 0, 3),
      (p_user_id, 'ラクマ', 'flea_market', 10, 0, 4),
      (p_user_id, 'その他', 'other', 0, 0, 5);
  end if;

  if not exists (select 1 from public.suppliers where user_id = p_user_id) then
    insert into public.suppliers (user_id, name, sort_order) values
      (p_user_id, 'セカンドストリート', 1),
      (p_user_id, 'ブックオフ', 2),
      (p_user_id, 'ハードオフ', 3),
      (p_user_id, 'オフハウス', 4),
      (p_user_id, 'ヤフオク', 5),
      (p_user_id, 'その他', 6);
  end if;

  if not exists (select 1 from public.categories where user_id = p_user_id) then
    insert into public.categories (user_id, name, sort_order)
    select p_user_id, c.name, c.ord
    from unnest(array[
      '時計', 'ブランド', 'メンズ服', 'レディース服', 'スニーカー', 'バッグ',
      '家電', 'カメラ', 'ゲーム', 'ホビー', 'アウトドア', 'その他'
    ]) with ordinality as c(name, ord);
  end if;

  if not exists (select 1 from public.shipping_templates where user_id = p_user_id) then
    insert into public.shipping_templates (user_id, name, cost, sort_order) values
      (p_user_id, 'ゆうパケットポスト', 215, 1),
      (p_user_id, 'ネコポス', 210, 2),
      (p_user_id, '宅急便コンパクト', 450, 3),
      (p_user_id, '60サイズ', 750, 4),
      (p_user_id, '80サイズ', 850, 5),
      (p_user_id, '100サイズ', 1050, 6);
  end if;
end;
$$;

revoke execute on function public.seed_user_defaults(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_user_defaults(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- マイグレーション前に作成済みのユーザー向け：ログイン時にアプリから呼ぶ
create or replace function public.ensure_user_defaults()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  perform public.seed_user_defaults(auth.uid());
end;
$$;

revoke execute on function public.ensure_user_defaults() from public, anon;
grant execute on function public.ensure_user_defaults() to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: 商品画像（非公開バケット。パスの先頭フォルダ = user_id）
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "product-images: own select" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "product-images: own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "product-images: own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "product-images: own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
