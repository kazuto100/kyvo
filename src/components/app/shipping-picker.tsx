"use client";

import { formatYen } from "@/lib/format";
import type { ShippingTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 送料テンプレートをタップで入力 */
export function ShippingPicker({
  templates,
  value,
  onPick,
  className,
}: {
  templates: ShippingTemplate[];
  value: number | null;
  onPick: (cost: number) => void;
  className?: string;
}) {
  if (templates.length === 0) return null;
  return (
    <div className={cn("-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none", className)}>
      {templates.map((t) => {
        const active = value === t.cost;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.cost)}
            className={cn(
              "flex shrink-0 flex-col items-start rounded-xl border px-3 py-1.5 text-left transition active:scale-95",
              active ? "border-brand bg-brand-soft text-brand" : "bg-surface hover:bg-accent",
            )}
          >
            <span className="text-[11px] leading-tight opacity-80">{t.name}</span>
            <span className="num text-sm font-semibold">{formatYen(t.cost)}</span>
          </button>
        );
      })}
    </div>
  );
}
