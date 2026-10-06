// DB の行型（supabase/migrations の定義と一致させる）

export const PRODUCT_STATUSES = [
  "purchased",
  "preparing",
  "listed",
  "sold",
  "shipped",
  "returned",
  "on_hold",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type Profile = {
  id: string;
  display_name: string | null;
  default_monthly_goal: number;
  recommend_min_profit: number;
  recommend_min_margin: number;
  consider_min_profit: number;
  consider_min_margin: number;
  stock_alert_days_warning: number;
  stock_alert_days_markdown: number;
  stock_alert_days_dispose: number;
};

export type PlatformKind = "flea_market" | "auction" | "marketplace" | "ec" | "other";

export type Platform = {
  id: string;
  name: string;
  kind: PlatformKind;
  fee_rate: number;
  fee_fixed: number;
  sort_order: number;
  is_active: boolean;
};

export type Supplier = { id: string; name: string; sort_order: number };

export type Store = {
  id: string;
  name: string;
  supplier_id: string | null;
  address: string | null;
  memo: string | null;
};

export type Brand = { id: string; name: string };

export type Category = { id: string; name: string; sort_order: number };

export type ShippingTemplate = {
  id: string;
  name: string;
  cost: number;
  sort_order: number;
};

export type MonthlyGoal = { id: string; month: string; goal_profit: number };

export type Expense = {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  memo: string | null;
};

export type Product = {
  id: string;
  user_id: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
  condition: string | null;
  image_urls: string[];
  memo: string | null;
  supplier_id: string | null;
  purchase_store_id: string | null;
  purchase_date: string;
  purchase_price: number;
  other_purchase_cost: number;
  selling_platform_id: string | null;
  expected_sale_price: number | null;
  actual_sale_price: number | null;
  listing_date: string | null;
  sold_date: string | null;
  listing_url: string | null;
  status: ProductStatus;
  shipping_cost: number;
  selling_fee: number;
  selling_fee_auto: boolean;
  other_cost: number;
  profit: number | null;
  profit_margin: number | null;
  roi: number | null;
  created_at: string;
  updated_at: string;
};

/** insert/update 時にクライアントから送る列（計算列は DB が上書きする） */
export type ProductInput = Omit<
  Product,
  "id" | "user_id" | "profit" | "profit_margin" | "roi" | "created_at" | "updated_at"
> & { id?: string };

/** フォーム・一覧で使うマスタ一式 */
export type MasterData = {
  profile: Profile;
  platforms: Platform[];
  suppliers: Supplier[];
  stores: Store[];
  brands: Brand[];
  categories: Category[];
  shippingTemplates: ShippingTemplate[];
};
