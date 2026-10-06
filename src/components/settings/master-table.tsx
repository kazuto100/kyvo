"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { YenInput } from "@/components/app/yen-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { parseDecimalInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Value = string | number | boolean | null;
type Row = { id: string } & Record<string, Value>;

export type Column = {
  key: string;
  label: string;
  type: "text" | "yen" | "percent" | "select" | "switch";
  options?: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
};

/**
 * マスタ（販売先・送料・カテゴリ等）のインライン編集。
 * 入力欄からフォーカスが外れた時点で自動保存する。
 */
export function MasterTable({
  table,
  rows: initialRows,
  columns,
  newRow,
  emptyText = "まだ登録がありません",
  deleteNote,
}: {
  table: string;
  rows: Row[];
  columns: Column[];
  newRow: Record<string, Value>;
  emptyText?: string;
  deleteNote?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [source, setSource] = useState(initialRows);
  const [draft, setDraft] = useState<Record<string, Value>>(newRow);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  // サーバー側の最新データが届いたら同期
  if (initialRows !== source) {
    setSource(initialRows);
    setRows(initialRows);
  }

  const supabase = () => createClient();

  async function commit(row: Row, key: string, value: Value) {
    const original = source.find((r) => r.id === row.id);
    if (original && original[key] === value) return;
    if (key === "name" && !String(value ?? "").trim()) {
      toast.error("名前を入力してください");
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, name: original?.name ?? "" } : r)));
      return;
    }
    setBusy(row.id);
    const { error } = await supabase().from(table).update({ [key]: value }).eq("id", row.id);
    setBusy(null);
    if (error) {
      toast.error(error.code === "23505" ? "同じ名前が既にあります" : error.message);
      setRows((rs) => rs.map((r) => (r.id === row.id && original ? original : r)));
      return;
    }
    toast.success("保存しました", { duration: 1200 });
    router.refresh();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if ("name" in draft && !String(draft.name ?? "").trim()) {
      toast.error("名前を入力してください");
      return;
    }
    setBusy("__new__");
    const payload = { ...draft, sort_order: rows.length + 1 };
    if (!("sort_order" in newRow)) delete (payload as Record<string, Value>).sort_order;
    const { error } = await supabase().from(table).insert(payload);
    setBusy(null);
    if (error) {
      toast.error(error.code === "23505" ? "同じ名前が既にあります" : error.message);
      return;
    }
    setDraft(newRow);
    toast.success("追加しました");
    router.refresh();
  }

  async function remove(row: Row) {
    setBusy(row.id);
    const { error } = await supabase().from(table).delete().eq("id", row.id);
    setBusy(null);
    setDeleting(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    toast.success("削除しました");
    router.refresh();
  }

  const update = (id: string, key: string, value: Value) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="py-2 text-sm text-muted-foreground">{emptyText}</p>}
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          {columns.map((col) => (
            <Cell
              key={col.key}
              col={col}
              value={row[col.key]}
              onChange={(v) => update(row.id, col.key, v)}
              onCommit={(v) => void commit(row, col.key, v)}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            onClick={() => setDeleting(row)}
            aria-label="削除"
            disabled={busy === row.id}
          >
            {busy === row.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
          </Button>
        </div>
      ))}

      <form onSubmit={add} className="flex items-center gap-2 border-t pt-3">
        {columns.map((col) => (
          <Cell
            key={col.key}
            col={col}
            value={draft[col.key] ?? null}
            onChange={(v) => setDraft((d) => ({ ...d, [col.key]: v }))}
            onCommit={() => {}}
            placeholderOverride={col.type === "text" ? `新しい${col.label}` : undefined}
          />
        ))}
        <Button type="submit" variant="secondary" size="icon" className="shrink-0" aria-label="追加" disabled={busy === "__new__"}>
          {busy === "__new__" ? <Loader2 className="animate-spin" /> : <Plus />}
        </Button>
      </form>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{String(deleting?.name ?? "")}」を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>{deleteNote ?? "登録済みの商品からは「未設定」として扱われます。"}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => deleting && void remove(deleting)}>
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Cell({
  col,
  value,
  onChange,
  onCommit,
  placeholderOverride,
}: {
  col: Column;
  value: Value;
  onChange: (v: Value) => void;
  onCommit: (v: Value) => void;
  placeholderOverride?: string;
}) {
  const cls = cn("min-w-0", col.className ?? "flex-1");
  switch (col.type) {
    case "text":
      return (
        <Input
          aria-label={col.label}
          className={cn(cls, "h-11")}
          value={String(value ?? "")}
          placeholder={placeholderOverride ?? col.placeholder ?? col.label}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value.trim())}
        />
      );
    case "yen":
      return (
        <div className={cls}>
          <YenInput
            aria-label={col.label}
            className="h-11"
            value={value === null ? null : Number(value)}
            onChange={(v) => onChange(v ?? 0)}
            onBlur={() => onCommit(value === null ? 0 : Number(value))}
            placeholder={col.placeholder}
          />
        </div>
      );
    case "percent":
      return (
        <div className={cn(cls, "flex h-11 items-center rounded-xl border border-input bg-surface pr-3 shadow-xs focus-within:ring-[3px] focus-within:ring-ring/30")}>
          <input
            aria-label={col.label}
            type="text"
            inputMode="decimal"
            className="num h-full w-full min-w-0 bg-transparent px-3 text-right outline-none"
            value={value === null ? "" : String(value)}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => {
              const v = Math.min(100, Math.max(0, parseDecimalInput(e.target.value) ?? 0));
              onChange(v);
              onCommit(v);
            }}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      );
    case "select":
      return (
        <NativeSelect
          aria-label={col.label}
          className={cn(cls, "[&_select]:h-11")}
          value={String(value ?? "")}
          onChange={(e) => {
            const v = e.target.value || null;
            onChange(v);
            onCommit(v);
          }}
        >
          <option value="">{col.placeholder ?? "未設定"}</option>
          {col.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      );
    case "switch":
      return (
        <div className={cn(col.className ?? "", "flex shrink-0 justify-center")}>
          <Switch
            aria-label={col.label}
            checked={!!value}
            onCheckedChange={(v) => {
              onChange(v);
              onCommit(v);
            }}
          />
        </div>
      );
  }
}
