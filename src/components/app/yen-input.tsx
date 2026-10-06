"use client";

import * as React from "react";
import { parseIntInput } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 金額入力。数字キーボードを表示し、全角・カンマも受け付ける。
 * value は number | null（空欄 = null）
 */
export function YenInput({
  value,
  onChange,
  className,
  size = "default",
  suffix,
  prefix = "¥",
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "size" | "prefix"> & {
  value: number | null;
  onChange: (value: number | null) => void;
  size?: "default" | "lg";
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
}) {
  const [text, setText] = React.useState(value === null ? "" : String(value));
  const [prevValue, setPrevValue] = React.useState(value);

  // 外部から値が変わった場合（テンプレート選択等）に表示を同期
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseIntInput(text) !== value) setText(value === null ? "" : String(value));
  }

  return (
    <div
      className={cn(
        "flex w-full items-center rounded-xl border border-input bg-surface shadow-xs transition-[box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
        size === "lg" ? "h-14" : "h-12",
        className,
      )}
    >
      {prefix && <span className="pl-3.5 text-muted-foreground select-none">{prefix}</span>}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="next"
        className={cn(
          "num h-full w-full min-w-0 bg-transparent px-2 outline-none placeholder:text-muted-foreground/50",
          size === "lg" ? "text-2xl font-semibold" : "text-lg font-medium",
        )}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const parsed = parseIntInput(raw);
          const next = parsed === null ? null : Math.max(0, parsed);
          setPrevValue(next);
          onChange(next);
        }}
        onFocus={(e) => e.currentTarget.select()}
        {...props}
      />
      {suffix && <span className="pr-3.5 text-sm text-muted-foreground select-none">{suffix}</span>}
    </div>
  );
}
