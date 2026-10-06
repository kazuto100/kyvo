"use client";

import { formatYen } from "@/lib/format";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

export function feeLabel(p: Platform) {
  const parts = [];
  if (p.fee_rate > 0 || p.fee_fixed === 0) parts.push(`${p.fee_rate}%`);
  if (p.fee_fixed > 0) parts.push(formatYen(p.fee_fixed));
  return parts.join(" + ");
}

/** 販売先をタップで選択（手数料率つき） */
export function PlatformPicker({
  platforms,
  value,
  onChange,
  allowNone = false,
}: {
  platforms: Platform[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone?: boolean;
}) {
  const list = platforms.filter((p) => p.is_active || p.id === value);
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
      {allowNone && (
        <PickerButton active={value === null} onClick={() => onChange(null)} title="未定" sub="—" />
      )}
      {list.map((p) => (
        <PickerButton key={p.id} active={value === p.id} onClick={() => onChange(p.id)} title={p.name} sub={feeLabel(p)} />
      ))}
    </div>
  );
}

function PickerButton({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-12 flex-col items-center justify-center rounded-xl border px-1.5 py-1.5 text-center transition active:scale-95",
        active ? "border-brand bg-brand-soft text-brand" : "bg-surface hover:bg-accent",
      )}
    >
      <span className="w-full truncate text-[13px] font-semibold">{title}</span>
      <span className="num text-[10px] opacity-70">{sub}</span>
    </button>
  );
}
