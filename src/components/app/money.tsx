import { formatPercent, formatYen } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 金額表示。tone="auto" で正=緑・負=赤 */
export function Money({
  value,
  tone = "none",
  sign = false,
  className,
}: {
  value: number | null | undefined;
  tone?: "auto" | "none";
  sign?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num",
        tone === "auto" && value != null && value > 0 && "text-profit",
        tone === "auto" && value != null && value < 0 && "text-loss",
        className,
      )}
    >
      {formatYen(value, { sign })}
    </span>
  );
}

export function Percent({
  value,
  tone = "none",
  className,
  digits = 1,
}: {
  value: number | null | undefined;
  tone?: "auto" | "none";
  className?: string;
  digits?: number;
}) {
  return (
    <span
      className={cn(
        "num",
        tone === "auto" && value != null && value > 0 && "text-profit",
        tone === "auto" && value != null && value < 0 && "text-loss",
        className,
      )}
    >
      {formatPercent(value, digits)}
    </span>
  );
}
