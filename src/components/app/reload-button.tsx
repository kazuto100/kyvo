"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReloadButton() {
  return (
    <Button size="lg" className="mt-6" onClick={() => window.location.reload()}>
      <RotateCcw />
      再読み込み
    </Button>
  );
}
