import { Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/app/money";
import { Progress } from "@/components/ui/progress";
import { formatNumber, formatPercent, formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";

export function GoalHero({
  monthLabel,
  profit,
  margin,
  goal,
  rate,
  remaining,
  remainingUnits,
  achieved,
  todayProfit,
  todayCount,
}: {
  monthLabel: string;
  profit: number;
  margin: number | null;
  goal: number;
  rate: number;
  remaining: number;
  remainingUnits: number | null;
  achieved: boolean;
  todayProfit: number;
  todayCount: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-6">
      <div className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{monthLabel}の利益</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              todayProfit > 0 ? "bg-profit-soft text-profit" : "bg-secondary text-muted-foreground",
            )}
          >
            <TrendingUp className="size-3.5" />
            今日 {formatYen(todayProfit, { sign: true })}
            <span className="font-normal opacity-80">（{todayCount}件）</span>
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <Money value={profit} tone="auto" className="text-[44px] leading-none font-bold tracking-tight sm:text-5xl" />
          <span className="num text-lg font-semibold text-muted-foreground">利益率 {formatPercent(margin)}</span>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-end justify-between text-sm">
            <Link href="/settings#goal" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <Target className="size-4" />
              月利益目標 <span className="num font-medium text-foreground">{formatYen(goal)}</span>
            </Link>
            <span className={cn("num text-2xl font-bold", achieved ? "text-profit" : "text-brand")}>
              {formatPercent(rate)}
            </span>
          </div>
          <Progress value={rate} className="h-3" indicatorClassName={achieved ? "bg-profit" : undefined} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-secondary px-3.5 py-3">
              <div className="text-[11px] text-muted-foreground">目標まで残り</div>
              <div className="num text-lg font-bold">{achieved ? "達成🎉" : formatYen(remaining)}</div>
            </div>
            <div className="rounded-2xl bg-secondary px-3.5 py-3">
              <div className="text-[11px] text-muted-foreground">あと何個売れば達成？</div>
              <div className="num text-lg font-bold">
                {achieved ? "—" : remainingUnits === null ? "販売実績待ち" : `あと${formatNumber(remainingUnits)}商品`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
