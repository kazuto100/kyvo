"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center">
      <AlertTriangle className="mb-3 size-10 text-warn" />
      <p className="font-semibold">データを読み込めませんでした</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {error.message || "通信状況を確認して、もう一度お試しください。"}
      </p>
      <Button className="mt-5" onClick={reset}>
        <RotateCcw />
        再読み込み
      </Button>
    </div>
  );
}
