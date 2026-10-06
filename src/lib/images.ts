"use client";

import { APP_CONFIG } from "@/config/app";
import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1600;

/** スマホ写真を長辺 1600px の JPEG に縮小（通信量・保存容量の節約） */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // HEIC 等ブラウザでデコードできない形式はそのままアップロード
    return file;
  }
}

function extensionFor(blob: Blob, file: File) {
  if (blob.type === "image/jpeg") return "jpg";
  const fromName = file.name.split(".").pop()?.toLowerCase();
  return fromName && fromName.length <= 5 ? fromName : "jpg";
}

/** Storage パス: {userId}/{productId}/{uuid}.jpg */
export async function uploadProductImage(userId: string, productId: string, file: File) {
  const blob = await compressImage(file);
  const path = `${userId}/${productId}/${crypto.randomUUID()}.${extensionFor(blob, file)}`;
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(APP_CONFIG.imageBucket)
    .upload(path, blob, { contentType: blob.type || file.type, upsert: false });
  if (error) throw new Error(`画像のアップロードに失敗しました: ${error.message}`);
  const { data } = await supabase.storage.from(APP_CONFIG.imageBucket).createSignedUrl(path, 3600);
  return { path, url: data?.signedUrl ?? URL.createObjectURL(blob) };
}

export async function deleteProductImages(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = createClient();
  const { error } = await supabase.storage.from(APP_CONFIG.imageBucket).remove(paths);
  if (error) console.warn("画像の削除に失敗しました", error.message);
}
