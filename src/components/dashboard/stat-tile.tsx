import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  sub,
  className,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card px-4 py-3.5", className)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("num mt-1 font-bold tracking-tight", emphasis ? "text-2xl" : "text-xl")}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
