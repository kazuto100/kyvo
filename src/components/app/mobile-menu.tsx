"use client";

import { Menu, Receipt, Settings, Warehouse, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** スマホでタブバーに無いページへのメニュー */
export function MobileMenu() {
  const items = [
    { href: "/products/quick", label: "クイック仕入れ", icon: Zap },
    { href: "/inventory", label: "在庫", icon: Warehouse },
    { href: "/expenses", label: "経費", icon: Receipt },
    { href: "/settings", label: "設定", icon: Settings },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="メニュー">
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
