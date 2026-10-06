import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ExpenseManager } from "@/components/expenses/expense-manager";
import { getExpenses } from "@/lib/data";
import { todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "経費" };

export default async function ExpensesPage() {
  const expenses = await getExpenses();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="経費" description="商品に紐づかない経費（月間利益から差し引き）" back="/" />
      <ExpenseManager expenses={expenses} today={todayISO()} />
    </div>
  );
}
