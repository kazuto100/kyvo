import { JUDGMENT_META, type Judgment } from "@/lib/profit";
import { cn } from "@/lib/utils";

const TONE: Record<Judgment, string> = {
  recommend: "bg-profit-soft text-profit border-profit/20",
  consider: "bg-warn-soft text-warn border-warn/20",
  skip: "bg-loss-soft text-loss border-loss/20",
};

export function JudgmentBanner({ judgment, className }: { judgment: Judgment | null; className?: string }) {
  if (!judgment) {
    return (
      <div className={cn("rounded-2xl border border-dashed px-4 py-3.5 text-center text-sm text-muted-foreground", className)}>
        販売価格と仕入価格を入れると判定します
      </div>
    );
  }
  const meta = JUDGMENT_META[judgment];
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3.5", TONE[judgment], className)}>
      <span className="text-2xl leading-none">{meta.emoji}</span>
      <div className="min-w-0">
        <div className="text-base font-bold">{meta.label}</div>
        <div className="text-xs opacity-80">{meta.description}</div>
      </div>
    </div>
  );
}

export function JudgmentPill({ judgment, className }: { judgment: Judgment; className?: string }) {
  const meta = JUDGMENT_META[judgment];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", TONE[judgment], className)}>
      {meta.emoji} {meta.label}
    </span>
  );
}
