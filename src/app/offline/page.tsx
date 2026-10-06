import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { ReloadButton } from "@/components/app/reload-button";
import { APP_CONFIG } from "@/config/app";

export const metadata: Metadata = { title: "オフライン" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-secondary">
        <WifiOff className="size-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold">オフラインです</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        電波の届く場所で再読み込みしてください。{APP_CONFIG.name} のデータはサーバーに安全に保存されています。
      </p>
      <ReloadButton />
    </main>
  );
}
