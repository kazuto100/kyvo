"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatYen } from "@/lib/format";

type Datum = { month: string; value: number };

const compactYen = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 10000) return `${v < 0 ? "-" : ""}${Math.round(abs / 1000) / 10}万`;
  return `${v}`;
};

/** 月別の単一系列バーチャート（利益・売上） */
export function MonthlyBarChart({
  data,
  color,
  negativeColor = "var(--loss)",
  label,
  highlightMonth,
}: {
  data: Datum[];
  color: string;
  negativeColor?: string;
  label: string;
  highlightMonth?: string;
}) {
  const hasData = data.some((d) => d.value !== 0);
  return (
    <div className="h-56 w-full" role="img" aria-label={`${label}の月別推移`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tickFormatter={(m: string) => `${Number(m.slice(5))}月`}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            interval={0}
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
                  <div className="text-muted-foreground">
                    {d.month.slice(0, 4)}年{Number(d.month.slice(5))}月
                  </div>
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
                key={d.month}
                fill={d.value < 0 ? negativeColor : color}
                fillOpacity={highlightMonth && d.month !== highlightMonth ? 0.55 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
