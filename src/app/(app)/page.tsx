import { AlertTriangle, Calculator, ChevronRight, Package, Plus, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DailyBarChart } from "@/components/analytics/monthly-chart";
import { EmptyState } from "@/components/app/empty-state";
import { Money, Percent } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { GoalHero } from "@/components/dashboard/goal-hero";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ProductRow } from "@/components/products/product-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dailyProfitSeries,
  goalProgress,
  inventorySummary,
  monthlySummary,
  soldProducts,
  summarizeSold,
} from "@/lib/analytics";
import { getExpenses, getMasterData, getMonthlyGoals, getProducts, resolveGoal, signImagePaths } from "@/lib/data";
import { currentMonthKey, formatMonthLabel, formatNumber, formatYen, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "ダッシュボード" };

export default async function DashboardPage() {
  const [master, products, expenses, goals] = await Promise.all([
    getMasterData(),
    getProducts(),
    getExpenses(),
    getMonthlyGoals(),
  ]);
  const { profile } = master;
  const today = todayISO();
  const month = currentMonthKey();

  const summary = monthlySummary(products, expenses, month);
  const todaySold = soldProducts(products).filter((p) => p.sold_date === today);
  const todayProfit = todaySold.reduce((s, p) => s + (p.profit ?? 0), 0);
  const allTimeAvg = summarizeSold(soldProducts(products)).avgProfit;
  const goal = goalProgress(summary.profit, resolveGoal(goals, profile, month), summary.count > 0 ? summary.avgProfit : allTimeAvg);
  const inventory = inventorySummary(products, today, profile);
  const monthPurchases = products.filter((p) => p.purchase_date.startsWith(month));
  const monthPurchaseSpend = monthPurchases.reduce((s, p) => s + p.purchase_price + p.other_purchase_cost, 0);
  const alertTotal = inventory.alerts.warning + inventory.alerts.markdown + inventory.alerts.dispose;

  const recent = [...products]
    .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
    .slice(0, 5);
  const signed = await signImagePaths(recent.map((p) => p.image_urls[0]).filter(Boolean));
  const brandName = (id: string | null) => master.brands.find((b) => b.id === id)?.name;

  return (
    <div className="space-y-5">
      <PageHeader
        title="ダッシュボード"
        description={new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", weekday: "short" }).format(new Date())}
        showSettings
      />

      <GoalHero
        monthLabel={formatMonthLabel(month)}
        profit={summary.profit}
        margin={summary.margin}
        goal={goal.goal}
        rate={goal.rate}
        remaining={goal.remaining}
        remainingUnits={goal.remainingUnits}
        achieved={goal.achieved}
        todayProfit={todayProfit}
        todayCount={todaySold.length}
      />

      <div className="grid grid-cols-3 gap-2.5">
        <QuickAction href="/products/quick" icon={Zap} label="クイック仕入れ" primary />
        <QuickAction href="/simulator" icon={Calculator} label="仕入れ判断" />
        <QuickAction href="/products/new" icon={Plus} label="商品を登録" />
      </div>

      {alertTotal > 0 && (
        <Link
          href="/inventory"
          className="flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm transition hover:opacity-90"
        >
          <AlertTriangle className="size-5 shrink-0 text-warn" />
          <span className="flex-1">
            長期在庫が <b className="num">{alertTotal}</b> 件あります
            <span className="ml-1 text-xs text-muted-foreground">
              （⚠️{inventory.alerts.warning} 🔴{inventory.alerts.markdown} 🚨{inventory.alerts.dispose}）
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      {summary.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>今月の日別利益</CardTitle>
            <span className="text-xs text-muted-foreground">売却日ベース</span>
          </CardHeader>
          <CardContent className="pt-2 pb-3">
            <DailyBarChart data={dailyProfitSeries(products, month)} color="var(--profit)" label="利益" today={today} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>今月の実績</CardTitle>
            <Link href="/analytics" className="text-xs text-brand">
              月別を見る
            </Link>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-[15px]">
              <BreakdownRow label="売上" value={<Money value={summary.sales} />} />
              <BreakdownRow label="仕入れ（売却分原価）" value={<Money value={summary.costOfGoods} />} muted />
              <BreakdownRow label="送料" value={<Money value={summary.shipping} />} muted />
              <BreakdownRow label="販売手数料" value={<Money value={summary.fees} />} muted />
              <BreakdownRow label="その他経費" value={<Money value={summary.otherCosts} />} muted />
              <div className="my-1 border-t" />
              <BreakdownRow label="利益" value={<Money value={summary.profit} tone="auto" className="text-xl font-bold" />} strong />
              <BreakdownRow label="利益率" value={<Percent value={summary.margin} tone="auto" className="text-lg font-bold" />} strong />
            </dl>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 content-start gap-2.5 sm:grid-cols-3 lg:col-span-3">
          <StatTile label="月間売上" value={formatYen(summary.sales)} />
          <StatTile label="販売数" value={`${formatNumber(summary.count)}個`} sub={`今月仕入れ ${monthPurchases.length}個`} />
          <StatTile label="平均利益" value={formatYen(Math.round(summary.avgProfit))} />
          <StatTile label="平均利益率" value={<Percent value={summary.avgMargin} />} />
          <StatTile label="在庫数" value={`${formatNumber(inventory.count)}個`} sub={<Link href="/inventory" className="text-brand">在庫を見る</Link>} />
          <StatTile label="在庫金額（原価）" value={formatYen(inventory.cost)} sub={`見込み利益 ${formatYen(inventory.expectedProfit)}`} />
          <StatTile label="今月の仕入れ額" value={formatYen(monthPurchaseSpend)} className="col-span-2 sm:col-span-3" />
        </div>
      </div>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-semibold">最近の商品</h2>
          <Link href="/products" className="text-xs text-brand">
            すべて見る
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={Package}
            title="まだ商品がありません"
            description="店舗で見つけた商品を登録すると、利益と目標達成率がここに表示されます。"
            action={
              <Button variant="brand" size="lg" asChild>
                <Link href="/products/quick">
                  <Zap />
                  クイック仕入れで登録
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {recent.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                imageUrl={signed[p.image_urls[0]]}
                brandName={brandName(p.brand_id)}
                today={today}
                thresholds={profile}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BreakdownRow({ label, value, muted, strong }: { label: string; value: React.ReactNode; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={muted ? "text-sm text-muted-foreground" : strong ? "font-semibold" : ""}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl bg-brand text-white shadow-sm shadow-brand/30 transition active:scale-[0.97]"
          : "flex h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card transition hover:bg-accent active:scale-[0.97]"
      }
    >
      <Icon className="size-5" />
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  );
}
