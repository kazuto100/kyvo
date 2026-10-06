"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatYen } from "@/lib/format";

type Datum = { key: string; value: number };

const compactYen = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 10000) return `${v < 0 ? "-" : ""}${Math.round(abs / 1000) / 10}万`;
  return `${v}`;
};

/** 単一系列のバーチャート（利益・売上の推移） */
export function BarSeriesChart({
  data,
  color,
  negativeColor = "var(--loss)",
  label,
  highlightKey,
  tickLabel,
  tooltipLabel,
  tickInterval = 0,
  height = "h-56",
}: {
  data: Datum[];
  color: string;
  negativeColor?: string;
  label: string;
  highlightKey?: string;
  tickLabel: (key: string) => string;
  tooltipLabel: (key: string) => string;
  tickInterval?: number;
  height?: string;
}) {
  const hasData = data.some((d) => d.value !== 0);
  return (
    <div className={`${height} w-full`} role="img" aria-label={`${label}の推移`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="key"
            tickFormatter={tickLabel}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tickFormatter={compactYen}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={hasData ? ["auto", "auto"] : [0, 100000]}
          />
          <Tooltip
            cursor={{ fill: "var(--accent)", radius: 6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as Datum;
              return (
                <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
                  <div className="text-muted-foreground">{tooltipLabel(d.key)}</div>
                  <div className="num text-sm font-semibold text-foreground">
                    {label} {formatYen(d.value)}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {data.map((d) => (
              <Cell
                key={d.key}
                fill={d.value < 0 ? negativeColor : color}
                fillOpacity={highlightKey && d.key !== highlightKey ? 0.55 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** 月別（1〜12月） */
export function MonthlyBarChart({
  data,
  highlightMonth,
  ...props
}: {
  data: { month: string; value: number }[];
  color: string;
  label: string;
  highlightMonth?: string;
}) {
  return (
    <BarSeriesChart
      {...props}
      data={data.map((d) => ({ key: d.month, value: d.value }))}
      highlightKey={highlightMonth}
      tickLabel={(m) => `${Number(m.slice(5))}月`}
      tooltipLabel={(m) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`}
    />
  );
}

/** 日別（その月の1日〜末日） */
export function DailyBarChart({
  data,
  today,
  ...props
}: {
  data: { key: string; value: number }[];
  color: string;
  label: string;
  today?: string;
}) {
  return (
    <BarSeriesChart
      {...props}
      data={data}
      highlightKey={today}
      height="h-40"
      tickInterval={4}
      tickLabel={(d) => `${Number(d.slice(8))}`}
      tooltipLabel={(d) => `${Number(d.slice(5, 7))}月${Number(d.slice(8))}日`}
    />
  );
}
