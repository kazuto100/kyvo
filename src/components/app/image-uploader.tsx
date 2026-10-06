"use client";

import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { APP_CONFIG } from "@/config/app";
import { deleteProductImages, uploadProductImage } from "@/lib/images";

export type UploadedImage = { path: string; url: string; isNew: boolean };

/** 商品画像（最大10枚）。選択と同時に Storage へアップロードする */
export function ImageUploader({
  userId,
  productId,
  images,
  onChange,
  onBusyChange,
}: {
  userId: string;
  productId: string;
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const remaining = APP_CONFIG.maxImages - images.length;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, remaining);
    if (files.length > remaining) toast.warning(`画像は最大${APP_CONFIG.maxImages}枚までです`);
    setUploading(list.length);
    onBusyChange?.(true);
    let current = images;
    for (const file of list) {
      try {
        const uploaded = await uploadProductImage(userId, productId, file);
        current = [...current, { ...uploaded, isNew: true }];
        onChange(current);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "画像のアップロードに失敗しました");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onBusyChange?.(false);
  }

  function remove(img: UploadedImage) {
    onChange(images.filter((i) => i.path !== img.path));
    // 未保存の画像はすぐ削除。保存済みの画像は商品保存時に削除する
    if (img.isNew) void deleteProductImages([img.path]);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {images.map((img, i) => (
          <div key={img.path} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
            <Image src={img.url} alt={`商品画像 ${i + 1}`} fill sizes="120px" className="object-cover" unoptimized />
            {i === 0 && (
              <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white">メイン</span>
            )}
            <button
              type="button"
              onClick={() => remove(img)}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="画像を削除"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <div key={`u${i}`} className="flex aspect-square items-center justify-center rounded-xl border bg-muted">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ))}
        {remaining - uploading > 0 && (
          <>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition hover:bg-accent active:scale-95"
            >
              <Camera className="size-5" />
              <span className="text-[10px]">撮影</span>
            </button>
            <button
              type="button"
              onClick={() => libraryRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition hover:bg-accent active:scale-95"
            >
              <ImagePlus className="size-5" />
              <span className="text-[10px]">選択</span>
            </button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {images.length}/{APP_CONFIG.maxImages}枚
      </p>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
