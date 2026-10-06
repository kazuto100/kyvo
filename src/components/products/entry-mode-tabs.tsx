import { ListChecks, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** クイック仕入れ ⇄ 詳細登録 の切り替え */
export function EntryModeTabs({ active }: { active: "quick" | "full" }) {
  const item = (key: "quick" | "full", href: string, label: string, Icon: typeof Zap) => (
    <Link
      href={href}
      replace
      className={cn(
        "flex h-full flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition",
        active === key ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
  return (
    <div className="mb-4 flex h-11 rounded-xl bg-secondary p-1">
      {item("quick", "/products/quick", "クイック仕入れ", Zap)}
      {item("full", "/products/new", "詳細登録", ListChecks)}
    </div>
  );
}
