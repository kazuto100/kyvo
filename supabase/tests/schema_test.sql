-- マイグレーションのトリガー・RLS 検証（ローカル Postgres 用）
\set ON_ERROR_STOP on
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

-- 初期データ投入確認
do $$ begin
  assert (select count(*) from public.platforms) = 5, 'platforms seeded';
  assert (select count(*) from public.categories) = 12, 'categories seeded';
  assert (select count(*) from public.shipping_templates) = 6, 'shipping seeded';
  assert (select default_monthly_goal from public.profiles) = 1000000, 'profile seeded';
end $$;

-- 仕様例: 販売 20,000 / 仕入 8,000 / 送料 750 / メルカリ10% → 利益 9,250 / 46.25%
insert into public.products (id, name, purchase_price, expected_sale_price, shipping_cost, selling_platform_id)
select 'aaaaaaaa-0000-0000-0000-000000000001', 'テスト商品', 8000, 20000, 750, id
from public.platforms where name = 'メルカリ';

do $$
declare p public.products;
begin
  select * into p from public.products where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  assert p.selling_fee = 2000, 'fee 2000, got ' || p.selling_fee;
  assert p.profit = 9250, 'profit 9250, got ' || p.profit;
  assert p.profit_margin = 46.25, 'margin 46.25, got ' || p.profit_margin;
  assert p.roi = 115.63, 'roi, got ' || p.roi;
  assert (select count(*) from public.sales) = 0, 'no sale yet';
end $$;

-- 手数料率の変更 → 未売却商品を再計算
update public.platforms set fee_rate = 8 where name = 'メルカリ';
do $$ begin
  assert (select selling_fee from public.products) = 1600, 'fee recalculated';
  assert (select profit from public.products) = 9650, 'profit recalculated';
end $$;

-- 売却登録 → 販売日自動補完・sales 台帳に同期
update public.products set status = 'sold', actual_sale_price = 22000;
do $$
declare p public.products;
begin
  select * into p from public.products;
  assert p.sold_date = public.today_jst(), 'sold_date defaulted';
  assert p.selling_fee = 1760, 'fee on actual price';
  assert p.profit = 22000 - 8000 - 750 - 1760, 'profit on actual price';
  assert (select profit from public.sales) = p.profit, 'sales synced';
end $$;

-- 売却済み商品は手数料率変更の影響を受けない
update public.platforms set fee_rate = 10 where name = 'メルカリ';
do $$ begin
  assert (select selling_fee from public.products) = 1760, 'sold fee kept';
end $$;

-- 手動手数料
update public.products set selling_fee_auto = false, selling_fee = 500;
do $$ begin
  assert (select profit from public.products) = 22000 - 8000 - 750 - 500, 'manual fee';
end $$;

-- 出品中に戻すと台帳から削除
update public.products set status = 'listed';
do $$ begin
  assert (select count(*) from public.sales) = 0, 'sale removed';
end $$;

-- 販売価格未入力 → 利益は null
insert into public.products (name, purchase_price) values ('価格未定', 1000);
do $$ begin
  assert (select profit from public.products where name = '価格未定') is null, 'null profit';
end $$;

-- RLS: 別ユーザーからは見えない・書けない
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from public.products) = 0, 'other user cannot see products';
  assert (select count(*) from public.platforms) = 5, 'own platforms only';
  update public.products set name = 'hacked';
  assert not found, 'cannot update others';
end $$;
do $$ begin
  begin
    insert into public.products (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'x');
    assert false, 'insert for other user must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sales (user_id, product_id, sold_date, sale_price, cost_of_goods, shipping_cost, selling_fee, other_cost, profit)
    values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', now(), 1, 1, 1, 1, 1, 1);
    assert false, 'direct sales insert must fail';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Storage RLS
insert into storage.objects (bucket_id, name) values ('product-images', '22222222-2222-2222-2222-222222222222/p/1.jpg');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('product-images', '11111111-1111-1111-1111-111111111111/p/1.jpg');
    assert false, 'storage insert to other folder must fail';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 未ログイン
reset role;
set role anon;
do $$ begin
  assert (select count(*) from public.products) = 0, 'anon sees nothing';
end $$;
reset role;
select 'ALL SCHEMA TESTS PASSED';
