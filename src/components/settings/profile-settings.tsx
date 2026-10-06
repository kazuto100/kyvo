"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { YenInput } from "@/components/app/yen-input";
import { Button } from "@/components/ui/button";
import { formatMonthLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

type NumKey = Exclude<keyof Profile, "id" | "display_name">;

/** 月利益目標（既定値 + 今月だけの目標） */
export function GoalSettings({
  profile,
  month,
  monthGoal,
}: {
  profile: Profile;
  month: string;
  monthGoal: number | null;
}) {
  const router = useRouter();
  const [defaultGoal, setDefaultGoal] = useState<number | null>(profile.default_monthly_goal);
  const [thisMonth, setThisMonth] = useState<number | null>(monthGoal);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    try {
      const r1 = await supabase
        .from("profiles")
        .update({ default_monthly_goal: defaultGoal ?? 0 })
        .eq("id", profile.id);
      if (r1.error) throw r1.error;
      const monthDate = `${month}-01`;
      const r2 =
        thisMonth === null
          ? await supabase.from("monthly_goals").delete().eq("month", monthDate)
          : await supabase.from("monthly_goals").upsert({ month: monthDate, goal_profit: thisMonth }, { onConflict: "user_id,month" });
      if (r2.error) throw r2.error;
      toast.success("目標を保存しました");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="月利益目標（毎月の既定値）" htmlFor="goal-default">
        <YenInput id="goal-default" value={defaultGoal} onChange={setDefaultGoal} size="lg" />
      </Field>
      <Field
        label={`${formatMonthLabel(month)}だけの目標`}
        htmlFor="goal-month"
        hint="空欄なら既定値を使います（繁忙期・閑散期の調整用）"
      >
        <YenInput id="goal-month" value={thisMonth} onChange={setThisMonth} placeholder="既定値を使用" />
      </Field>
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving && <Loader2 className="animate-spin" />}
        目標を保存
      </Button>
    </form>
  );
}

/** 仕入れ判断基準・長期在庫アラート */
export function ThresholdSettings({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<NumKey, number | null>>({
    default_monthly_goal: profile.default_monthly_goal,
    recommend_min_profit: profile.recommend_min_profit,
    recommend_min_margin: profile.recommend_min_margin,
    consider_min_profit: profile.consider_min_profit,
    consider_min_margin: profile.consider_min_margin,
    stock_alert_days_warning: profile.stock_alert_days_warning,
    stock_alert_days_markdown: profile.stock_alert_days_markdown,
    stock_alert_days_dispose: profile.stock_alert_days_dispose,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: NumKey) => (v: number | null) => setValues((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const v = values;
    if ((v.consider_min_profit ?? 0) > (v.recommend_min_profit ?? 0) || (v.consider_min_margin ?? 0) > (v.recommend_min_margin ?? 0)) {
      toast.error("「要検討」の基準は「おすすめ」以下にしてください");
      return;
    }
    if (!((v.stock_alert_days_warning ?? 0) < (v.stock_alert_days_markdown ?? 0) && (v.stock_alert_days_markdown ?? 0) < (v.stock_alert_days_dispose ?? 0))) {
      toast.error("在庫アラート日数は 経過 < 値下げ < 処分 の順にしてください");
      return;
    }
    setSaving(true);
    const { error } = await createClient()
      .from("profiles")
      .update({
        recommend_min_profit: v.recommend_min_profit ?? 0,
        recommend_min_margin: Math.min(100, v.recommend_min_margin ?? 0),
        consider_min_profit: v.consider_min_profit ?? 0,
        consider_min_margin: Math.min(100, v.consider_min_margin ?? 0),
        stock_alert_days_warning: v.stock_alert_days_warning ?? 30,
        stock_alert_days_markdown: v.stock_alert_days_markdown ?? 60,
        stock_alert_days_dispose: v.stock_alert_days_dispose ?? 90,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("基準を保存しました");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm font-medium">🔥 仕入れおすすめ（両方を満たす）</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="利益（以上）">
            <YenInput value={values.recommend_min_profit} onChange={set("recommend_min_profit")} />
          </Field>
          <Field label="利益率（以上）">
            <YenInput value={values.recommend_min_margin} onChange={set("recommend_min_margin")} prefix={null} suffix="%" decimal />
          </Field>
        </div>
        <p className="text-sm font-medium">❌ 見送り（どちらかを下回る）</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="利益（未満）">
            <YenInput value={values.consider_min_profit} onChange={set("consider_min_profit")} />
          </Field>
          <Field label="利益率（未満）">
            <YenInput value={values.consider_min_margin} onChange={set("consider_min_margin")} prefix={null} suffix="%" decimal />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">その間は ⚠️ 要検討。おすすめの利益額は「最大仕入価格」の目標利益にも使います。</p>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium">長期在庫アラート（仕入日からの日数）</p>
        <div className="grid grid-cols-3 gap-2">
          <Field label="⚠️ 経過">
            <YenInput value={values.stock_alert_days_warning} onChange={set("stock_alert_days_warning")} prefix={null} suffix="日" />
          </Field>
          <Field label="🔴 値下げ">
            <YenInput value={values.stock_alert_days_markdown} onChange={set("stock_alert_days_markdown")} prefix={null} suffix="日" />
          </Field>
          <Field label="🚨 処分">
            <YenInput value={values.stock_alert_days_dispose} onChange={set("stock_alert_days_dispose")} prefix={null} suffix="日" />
          </Field>
        </div>
      </div>
      <Button type="submit" disabled={saving} className="w-full sm:w-auto">
        {saving && <Loader2 className="animate-spin" />}
        基準を保存
      </Button>
    </form>
  );
}
