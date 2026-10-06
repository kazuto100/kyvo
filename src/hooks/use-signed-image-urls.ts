"use client";

import { useEffect, useState } from "react";
import { APP_CONFIG } from "@/config/app";
import { createClient } from "@/lib/supabase/client";

const TTL_SEC = 3600;
// ページをまたいで再利用する署名付き URL のキャッシュ（期限の5分前に再取得）
const cache = new Map<string, { url: string; expiresAt: number }>();

function fresh(path: string) {
  const hit = cache.get(path);
  return hit && hit.expiresAt - 300_000 > Date.now() ? hit.url : undefined;
}

/**
 * 表示中の画像だけ署名付き URL を取得する（一覧の件数が多くてもサーバー負荷が増えない）
 */
export function useSignedImageUrls(paths: string[]): Record<string, string> {
  const [, setVersion] = useState(0);
  const key = paths.join("|");

  useEffect(() => {
    const missing = [...new Set(key.split("|").filter((p) => p && !fresh(p)))];
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const storage = createClient().storage.from(APP_CONFIG.imageBucket);
      for (let i = 0; i < missing.length; i += 100) {
        const { data } = await storage.createSignedUrls(missing.slice(i, i + 100), TTL_SEC);
        for (const item of Array.isArray(data) ? data : []) {
          if (item.path && item.signedUrl) {
            cache.set(item.path, { url: item.signedUrl, expiresAt: Date.now() + TTL_SEC * 1000 });
          }
        }
      }
      if (!cancelled) setVersion((v) => v + 1);
    })().catch(() => {
      /* 画像が取得できなくても一覧は表示する */
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const result: Record<string, string> = {};
  for (const p of paths) {
    const url = fresh(p);
    if (url) result[p] = url;
  }
  return result;
}
