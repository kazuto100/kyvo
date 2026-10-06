import { APP_CONFIG } from "@/config/app";

const yenFormatter = new Intl.NumberFormat("ja-JP");

export function formatYen(value: number | null | undefined, opts?: { sign?: boolean }): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = yenFormatter.format(Math.abs(Math.round(value)));
  if (value < 0) return `-¥${abs}`;
  if (opts?.sign && value > 0) return `+¥${abs}`;
  return `¥${abs}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return yenFormatter.format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits).replace(/\.0+$/, "")}%`;
}

/** 日本時間の今日 (YYYY-MM-DD) */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: APP_CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** YYYY-MM */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function currentMonthKey(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${y}/${m}/${d}`;
}

export function formatShortDate(date: string | null | undefined): string {
  if (!date) return "—";
  const [, m, d] = date.slice(0, 10).split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${y}年${Number(m)}月`;
}

/** 2つの日付 (YYYY-MM-DD) の差（日） */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** 数値入力の文字列 → 整数（全角数字・カンマ対応）。空なら null */
export function parseIntInput(value: string): number | null {
  const normalized = value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，¥￥\s]/g, "");
  if (normalized === "") return null;
  const v = Number.parseInt(normalized, 10);
  return Number.isFinite(v) ? v : null;
}

export function parseDecimalInput(value: string): number | null {
  const normalized = value
    .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，%％\s]/g, "");
  if (normalized === "") return null;
  const v = Number.parseFloat(normalized);
  return Number.isFinite(v) ? v : null;
}
