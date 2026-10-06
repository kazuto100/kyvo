"use client";

import { Loader2, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const current = mounted ? (theme ?? "system") : "system";
  const options = [
    { key: "light", label: "ライト", icon: Sun },
    { key: "dark", label: "ダーク", icon: Moon },
    { key: "system", label: "自動", icon: Monitor },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => setTheme(key)}
          aria-pressed={current === key}
          className={cn(
            "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm transition",
            current === key ? "border-brand bg-brand-soft text-brand" : "hover:bg-accent",
          )}
        >
          <Icon className="size-5" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function AccountSettings({ email }: { email: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    const { error } = await createClient().auth.signOut();
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">ログイン中</p>
        <p className="truncate text-sm font-medium">{email}</p>
      </div>
      <Button variant="outline" onClick={signOut} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <LogOut />}
        ログアウト
      </Button>
    </div>
  );
}
