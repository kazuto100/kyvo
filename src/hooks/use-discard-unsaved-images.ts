"use client";

import { useEffect, useRef } from "react";
import type { UploadedImage } from "@/components/app/image-uploader";
import { deleteProductImages } from "@/lib/images";

/**
 * フォームで新しくアップロードした画像を、保存せずに離れた場合に Storage から削除する。
 * 戻り値の markSaved() を保存成功時に呼ぶ。
 */
export function useDiscardUnsavedImages(images: UploadedImage[]) {
  const imagesRef = useRef(images);
  const savedRef = useRef(false);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    const discard = () => {
      if (savedRef.current) return;
      const paths = imagesRef.current.filter((i) => i.isNew).map((i) => i.path);
      if (paths.length) void deleteProductImages(paths);
      imagesRef.current = imagesRef.current.filter((i) => !i.isNew);
    };
    // タブを閉じた場合（ベストエフォート）と、アプリ内で別ページへ移動した場合
    window.addEventListener("pagehide", discard);
    return () => {
      window.removeEventListener("pagehide", discard);
      discard();
    };
  }, []);

  return {
    markSaved: () => {
      savedRef.current = true;
    },
  };
}
