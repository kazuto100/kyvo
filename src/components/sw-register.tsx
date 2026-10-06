"use client";

import { useEffect } from "react";

/** 本番ビルドのみ Service Worker を登録（開発中のキャッシュ混乱を避ける） */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
