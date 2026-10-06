"use client";

import {
  BarChart3,
  Calculator,
  Home,
  Package,
  Plus,
  Receipt,
  Settings,
  Warehouse,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_CONFIG } from "@/config/app";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "ホーム", icon: Home },
  { href: "/products", label: "商品", icon: Package },
  { href: "/simulator", label: "判定", icon: Calculator },
  { href: "/analytics", label: "分析", icon: BarChart3 },
] as const;

const SIDEBAR = [
  { href: "/", label: "ダッシュボード", icon: Home },
  { href: "/products", label: "商品一覧", icon: Package },
  { href: "/products/quick", label: "クイック仕入れ", icon: Zap },
  { href: "/simulator", label: "仕入れ判断", icon: Calculator },
  { href: "/inventory", label: "在庫", icon: Warehouse },
  { href: "/analytics", label: "分析", icon: BarChart3 },
  { href: "/expenses", label: "経費", icon: Receipt },
  { href: "/settings", label: "設定", icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/products") return pathname === "/products" || /^\/products\/(?!new|quick)/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-surface/80 px-3 py-5 backdrop-blur lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
            {APP_CONFIG.name.slice(0, 1)}
          </span>
          <span className="text-[15px] font-bold tracking-tight">{APP_CONFIG.name}</span>
        </Link>
        <Link
          href="/products/new"
          className="mb-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 active:scale-[0.98]"
        >
          <Plus className="size-4" />
          商品を登録
        </Link>
        <nav className="flex flex-col gap-0.5">
          {SIDEBAR.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground",
                isActive(pathname, href) && "bg-accent font-medium text-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface/85 pb-safe backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
          {TABS.slice(0, 2).map((t) => (
            <TabLink key={t.href} {...t} active={isActive(pathname, t.href)} />
          ))}
          <div className="flex justify-center">
            <Link
              href="/products/new"
              aria-label="商品を登録"
              className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30 transition active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.5} />
            </Link>
          </div>
          {TABS.slice(2).map((t) => (
            <TabLink key={t.href} {...t} active={isActive(pathname, t.href)} />
          ))}
        </div>
      </nav>
    </>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition",
        active && "text-foreground",
      )}
    >
      <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />
      {label}
    </Link>
  );
}
