"use client";

import { Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Field } from "@/components/app/field";
import { YenInput } from "@/components/app/yen-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatMonthLabel, formatShortDate, formatYen, monthKey } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Expense } from "@/lib/types";

/** 商品に紐づかない経費（梱包資材・交通費など）。月間利益から差し引かれる */
export function ExpenseManager({ expenses, today }: { expenses: Expense[]; today: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState<number | null>(null);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const byMonth = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of expenses) {
      const k = monthKey(e.expense_date);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [expenses]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) {
      toast.error("金額を入力してください");
      return;
    }
    setBusy("new");
    const { error } = await createClient()
      .from("expenses")
      .insert({ expense_date: date || today, category, amount, memo: memo.trim() || null });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    setAmount(null);
    setMemo("");
    toast.success("経費を追加しました");
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(id);
    const { error } = await createClient().from("expenses").delete().eq("id", id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("削除しました");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="日付" htmlFor="exp-date">
            <Input id="exp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="金額" htmlFor="exp-amount">
            <YenInput id="exp-amount" value={amount} onChange={setAmount} placeholder="0" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="区分" htmlFor="exp-cat">
            <NativeSelect id="exp-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="メモ" htmlFor="exp-memo">
            <Input id="exp-memo" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="任意" />
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy === "new"}>
          {busy === "new" ? <Loader2 className="animate-spin" /> : <Plus />}
          経費を追加
        </Button>
      </form>

      {byMonth.length === 0 ? (
        <EmptyState icon={Receipt} title="経費はまだありません" description="梱包資材や仕入れの交通費などを記録すると、月間利益に反映されます。" />
      ) : (
        byMonth.map(([month, list]) => (
          <section key={month}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{formatMonthLabel(month)}</h2>
              <span className="num text-sm font-semibold">{formatYen(list.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
            <div className="divide-y rounded-2xl border bg-card">
              {list.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="num w-10 shrink-0 text-xs text-muted-foreground">{formatShortDate(e.expense_date)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{e.category}</p>
                    {e.memo && <p className="truncate text-xs text-muted-foreground">{e.memo}</p>}
                  </div>
                  <span className="num text-sm font-medium">{formatYen(e.amount)}</span>
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => void remove(e.id)} disabled={busy === e.id} aria-label="削除">
                    {busy === e.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
