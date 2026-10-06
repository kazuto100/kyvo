import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { AccountSettings, AppearanceSettings } from "@/components/settings/account-settings";
import { DataSettings } from "@/components/settings/data-settings";
import { MasterTable } from "@/components/settings/master-table";
import { GoalSettings, ThresholdSettings } from "@/components/settings/profile-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_CONFIG } from "@/config/app";
import { getMasterData, getMonthlyGoals, requireUser } from "@/lib/data";
import { currentMonthKey } from "@/lib/format";

export const metadata: Metadata = { title: "設定" };

const SECTIONS = [
  ["goal", "目標"],
  ["criteria", "判断基準"],
  ["platforms", "販売先・手数料"],
  ["shipping", "送料"],
  ["categories", "カテゴリ"],
  ["brands", "ブランド"],
  ["suppliers", "仕入先"],
  ["stores", "店舗"],
  ["data", "CSV"],
  ["account", "アカウント"],
] as const;

export default async function SettingsPage() {
  const [user, master, goals] = await Promise.all([requireUser(), getMasterData(), getMonthlyGoals()]);
  const month = currentMonthKey();
  const monthGoal = goals.find((g) => g.month.startsWith(month))?.goal_profit ?? null;
  const { profile } = master;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="設定" back="/" />

      <nav className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="h-8 shrink-0 rounded-full border bg-surface px-3 text-[13px] leading-8 text-muted-foreground hover:bg-accent">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-4">
        <Section id="goal" title="月利益目標" description="ダッシュボードの達成率・残り金額の計算に使います">
          <GoalSettings key={`${profile.default_monthly_goal}-${monthGoal}`} profile={profile} month={month} monthGoal={monthGoal} />
        </Section>

        <Section id="criteria" title="仕入れ判断・在庫アラート" description="🔥おすすめ / ⚠️要検討 / ❌見送り の判定基準">
          <ThresholdSettings profile={profile} />
        </Section>

        <Section
          id="platforms"
          title="販売先と手数料"
          description="販売手数料 = 販売価格 × 料率 + 固定額（1円未満切り捨て）。変更すると未売却商品の見込み利益も再計算されます"
        >
          <div className="mb-1 flex gap-2 pr-12 text-[11px] text-muted-foreground">
            <span className="flex-1">販売先</span>
            <span className="w-20 text-center">料率</span>
            <span className="w-24 text-center">固定額</span>
            <span className="w-10 text-center">表示</span>
          </div>
          <MasterTable
            table="platforms"
            rows={master.platforms}
            columns={[
              { key: "name", label: "販売先", type: "text" },
              { key: "fee_rate", label: "料率", type: "percent", className: "w-20 shrink-0" },
              { key: "fee_fixed", label: "固定額", type: "yen", className: "w-24 shrink-0" },
              { key: "is_active", label: "表示", type: "switch", className: "w-10" },
            ]}
            newRow={{ name: "", fee_rate: 10, fee_fixed: 0, is_active: true, sort_order: 0 }}
            deleteNote="この販売先の商品は「販売先なし」になります。売却済み商品の手数料はそのまま、未売却商品の見込み手数料は0円になります（非表示にするだけなら「表示」をオフに）。"
          />
        </Section>

        <Section id="shipping" title="送料テンプレート" description="商品登録・仕入れ判断でワンタップ入力できます">
          <MasterTable
            table="shipping_templates"
            rows={master.shippingTemplates}
            columns={[
              { key: "name", label: "配送方法", type: "text" },
              { key: "cost", label: "送料", type: "yen", className: "w-28 shrink-0" },
            ]}
            newRow={{ name: "", cost: 0, sort_order: 0 }}
            deleteNote="登録済み商品の送料は変わりません。"
          />
        </Section>

        <Section id="categories" title="カテゴリ">
          <MasterTable table="categories" rows={master.categories} columns={[{ key: "name", label: "カテゴリ", type: "text" }]} newRow={{ name: "", sort_order: 0 }} />
        </Section>

        <Section id="brands" title="ブランド" description="商品登録時に新しいブランド名を入力すると自動で追加されます">
          <MasterTable table="brands" rows={master.brands} columns={[{ key: "name", label: "ブランド", type: "text" }]} newRow={{ name: "" }} />
        </Section>

        <Section id="suppliers" title="仕入先" description="セカンドストリート・ブックオフなどのチェーン・仕入れサービス">
          <MasterTable table="suppliers" rows={master.suppliers} columns={[{ key: "name", label: "仕入先", type: "text" }]} newRow={{ name: "", sort_order: 0 }} />
        </Section>

        <Section id="stores" title="仕入店舗" description="例: セカンドストリート多治見店。店舗別分析に使います">
          <MasterTable
            table="stores"
            rows={master.stores}
            columns={[
              { key: "name", label: "店舗", type: "text" },
              {
                key: "supplier_id",
                label: "仕入先",
                type: "select",
                className: "w-36 shrink-0",
                placeholder: "仕入先",
                options: master.suppliers.map((s) => ({ value: s.id, label: s.name })),
              },
            ]}
            newRow={{ name: "", supplier_id: null }}
          />
        </Section>

        <Section id="data" title="データ（CSV）">
          <DataSettings master={master} />
        </Section>

        <Section id="appearance" title="表示">
          <AppearanceSettings />
        </Section>

        <Section id="account" title="アカウント">
          <AccountSettings email={user.email} />
        </Section>

        <p className="pt-2 text-center text-xs text-muted-foreground">
          {APP_CONFIG.name} · {APP_CONFIG.tagline}
        </p>
      </div>
    </div>
  );
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-4">
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
