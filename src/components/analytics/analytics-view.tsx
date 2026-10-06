"use client";

import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/app/empty-state";
import { Money, Percent } from "@/components/app/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  availableYears,
  groupAnalysis,
  monthlySeries,
  ranking,
  yearlySummary,
  type GroupRow,
  type RankingKey,
} from "@/lib/analytics";
import { formatNumber, formatYen } from "@/lib/format";
import type { Expense, MasterData, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MonthlyBarChart } from "./monthly-chart";

const TABS = [
  ["monthly", "月別"],
  ["yearly", "年間"],
  ["ranking", "ランキング"],
  ["supplier", "仕入先"],
  ["store", "店舗"],
  ["brand", "ブランド"],
  ["category", "カテゴリ"],
  ["platform", "販売先"],
] as const;

export function AnalyticsView({
  products,
  expenses,
  master,
  currentMonth,
}: {
  products: Product[];
  expenses: Expense[];
  master: MasterData;
  currentMonth: string;
}) {
  const currentYear = Number(currentMonth.slice(0, 4));
  const years = useMemo(() => availableYears(products, expenses, currentYear), [products, expenses, currentYear]);
  const [year, setYear] = useState(currentYear);
  const series = useMemo(() => monthlySeries(products, expenses, year), [products, expenses, year]);
  const yearly = useMemo(() => yearlySummary(products, expenses, year), [products, expenses, year]);
  // 分析対象: 選択年に仕入れた or 売れた商品
  const yearProducts = useMemo(
    () => products.filter((p) => p.purchase_date.startsWith(String(year)) || p.sold_date?.startsWith(String(year))),
    [products, year],
  );
  const soldInYear = useMemo(() => products.filter((p) => p.sold_date?.startsWith(String(year))), [products, year]);

  const nameMap = (list: { id: string; name: string }[]) => {
    const m = new Map(list.map((x) => [x.id, x.name]));
    return (k: string) => m.get(k) ?? "（削除済み）";
  };
  const groups = useMemo(
    () => ({
      supplier: groupAnalysis(yearProducts, (p) => p.supplier_id, nameMap(master.suppliers)),
      store: groupAnalysis(yearProducts, (p) => p.purchase_store_id, nameMap(master.stores)),
      brand: groupAnalysis(yearProducts, (p) => p.brand_id, nameMap(master.brands)),
      category: groupAnalysis(yearProducts, (p) => p.category_id, nameMap(master.categories)),
      platform: groupAnalysis(yearProducts, (p) => p.selling_platform_id, nameMap(master.platforms)),
    }),
    [yearProducts, master],
  );

  if (products.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="分析できるデータがまだありません"
        description="商品を登録して売却を記録すると、月別の売上・利益や仕入先ごとの成績が表示されます。"
      />
    );
  }

  return (
    <Tabs defaultValue="monthly" className="gap-4">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-1 sm:px-0">
          <TabsList>
            {TABS.map(([k, label]) => (
              <TabsTrigger key={k} value={k} className="px-3.5">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <NativeSelect
          aria-label="対象年"
          value={String(year)}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-28 shrink-0 self-end [&_select]:h-10"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </NativeSelect>
      </div>

      <TabsContent value="monthly" className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>月別利益</CardTitle>
              <Money value={yearly.profit} tone="auto" className="text-sm font-semibold" />
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              <MonthlyBarChart
                data={series.map((s) => ({ month: s.month, value: s.profit }))}
                color="var(--profit)"
                label="利益"
                highlightMonth={currentMonth}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>月別売上</CardTitle>
              <Money value={yearly.sales} className="text-sm font-semibold" />
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              <MonthlyBarChart
                data={series.map((s) => ({ month: s.month, value: s.sales }))}
                color="var(--brand)"
                label="売上"
                highlightMonth={currentMonth}
              />
            </CardContent>
          </Card>
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-secondary/50 text-xs text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-right [&>th]:font-medium">
                  <th className="!text-left">月</th>
                  <th>売上</th>
                  <th>仕入れ</th>
                  <th>送料</th>
                  <th>手数料</th>
                  <th>その他経費</th>
                  <th>利益</th>
                  <th>利益率</th>
                  <th>販売数</th>
                </tr>
              </thead>
              <tbody className="num">
                {series.map((s) => (
                  <tr
                    key={s.month}
                    className={cn("border-b last:border-0 [&>td]:px-3 [&>td]:py-2 [&>td]:text-right", s.month === currentMonth && "bg-brand-soft/60")}
                  >
                    <td className="!text-left font-medium">{Number(s.month.slice(5))}月</td>
                    <td>{formatYen(s.sales)}</td>
                    <td className="text-muted-foreground">{formatYen(s.costOfGoods)}</td>
                    <td className="text-muted-foreground">{formatYen(s.shipping)}</td>
                    <td className="text-muted-foreground">{formatYen(s.fees)}</td>
                    <td className="text-muted-foreground">{formatYen(s.otherCosts)}</td>
                    <td>
                      <Money value={s.profit} tone="auto" className="font-semibold" />
                    </td>
                    <td>
                      <Percent value={s.margin} />
                    </td>
                    <td>{s.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="num border-t bg-secondary/40 font-semibold">
                <tr className="[&>td]:px-3 [&>td]:py-2.5 [&>td]:text-right">
                  <td className="!text-left">合計</td>
                  <td>{formatYen(yearly.sales)}</td>
                  <td>{formatYen(yearly.costOfGoods)}</td>
                  <td>{formatYen(yearly.shipping)}</td>
                  <td>{formatYen(yearly.fees)}</td>
                  <td>{formatYen(yearly.otherCosts)}</td>
                  <td>
                    <Money value={yearly.profit} tone="auto" />
                  </td>
                  <td>
                    <Percent value={yearly.margin} />
                  </td>
                  <td>{yearly.count}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
        <p className="text-xs text-muted-foreground">
          ※ 売上・利益は販売日で計上。「仕入れ」はその月に売れた商品の仕入原価です。その他経費には経費ページの一般経費を含みます。
        </p>
      </TabsContent>

      <TabsContent value="yearly">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Tile label="総売上" value={formatYen(yearly.sales)} />
          <Tile label="総仕入れ（売却分原価）" value={formatYen(yearly.costOfGoods)} />
          <Tile label="総経費" value={formatYen(yearly.totalExpenses)} sub="送料＋手数料＋その他" />
          <Tile label="総利益" value={<Money value={yearly.profit} tone="auto" />} emphasis />
          <Tile label="平均利益率" value={<Percent value={yearly.avgMargin} />} sub={<>全体の利益率 <Percent value={yearly.margin} /></>} />
          <Tile label="販売数" value={`${formatNumber(yearly.count)}個`} sub={`平均利益 ${formatYen(Math.round(yearly.avgProfit))}`} />
        </div>
      </TabsContent>

      <TabsContent value="ranking" className="grid gap-4 lg:grid-cols-3">
        <RankingCard title="利益額 TOP10" products={soldInYear} rankKey="profit" />
        <RankingCard title="利益率 TOP10" products={soldInYear} rankKey="margin" />
        <RankingCard title="売上 TOP10" products={soldInYear} rankKey="sales" />
      </TabsContent>

      {(["supplier", "store", "brand", "category", "platform"] as const).map((k) => (
        <TabsContent key={k} value={k}>
          <GroupTable rows={groups[k]} label={TABS.find(([t]) => t === k)![1]} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Tile({ label, value, sub, emphasis }: { label: string; value: React.ReactNode; sub?: React.ReactNode; emphasis?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("num mt-1 font-bold tracking-tight", emphasis ? "text-3xl" : "text-xl")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

function RankingCard({ title, products, rankKey }: { title: string; products: Product[]; rankKey: RankingKey }) {
  const list = ranking(products, rankKey, 10);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {list.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">売却済みの商品がありません</p>
        ) : (
          <ol className="space-y-1">
            {list.map((p, i) => (
              <li key={p.id}>
                <Link href={`/products/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent">
                  <span className="w-6 shrink-0 text-center text-base">{MEDALS[i] ?? <span className="num text-xs text-muted-foreground">{i + 1}</span>}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                  <span className="shrink-0 text-right text-sm font-semibold">
                    {rankKey === "profit" && <Money value={p.profit} tone="auto" />}
                    {rankKey === "margin" && <Percent value={p.profit_margin} tone="auto" />}
                    {rankKey === "sales" && <Money value={p.actual_sale_price} />}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function GroupTable({ rows, label }: { rows: GroupRow[]; label: string }) {
  if (rows.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">データがありません</p>;
  const best = rows.filter((r) => r.soldCount > 0).sort((a, b) => b.avgProfit - a.avgProfit)[0];
  return (
    <div className="space-y-3">
      {best && (
        <p className="rounded-2xl bg-profit-soft px-4 py-3 text-sm">
          平均利益が最も高い{label}は <b>{best.label}</b>（1商品あたり <b className="num">{formatYen(Math.round(best.avgProfit))}</b>）
        </p>
      )}
      {/* スマホ: カード */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => (
          <div key={r.key} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{r.label}</p>
              <Money value={r.profit} tone="auto" className="text-lg font-bold" />
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
              <Stat label="仕入数" value={`${r.purchaseCount}`} />
              <Stat label="仕入総額" value={formatYen(r.purchaseTotal)} />
              <Stat label="販売数" value={`${r.soldCount}`} />
              <Stat label="売上" value={formatYen(r.sales)} />
              <Stat label="平均利益" value={formatYen(Math.round(r.avgProfit))} />
              <Stat label="平均利益率" value={<Percent value={r.avgMargin} />} />
            </dl>
          </div>
        ))}
      </div>
      {/* PC: テーブル */}
      <Card className="hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/50 text-xs text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-right [&>th]:font-medium">
              <th className="!text-left">{label}</th>
              <th>仕入数</th>
              <th>仕入総額</th>
              <th>販売数</th>
              <th>売上</th>
              <th>利益</th>
              <th>平均利益</th>
              <th>平均利益率</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0 [&>td]:px-3 [&>td]:py-2.5 [&>td]:text-right">
                <td className="!text-left font-medium">{r.label}</td>
                <td>{r.purchaseCount}</td>
                <td>{formatYen(r.purchaseTotal)}</td>
                <td>{r.soldCount}</td>
                <td>{formatYen(r.sales)}</td>
                <td>
                  <Money value={r.profit} tone="auto" className="font-semibold" />
                </td>
                <td>{formatYen(Math.round(r.avgProfit))}</td>
                <td>
                  <Percent value={r.avgMargin} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}

