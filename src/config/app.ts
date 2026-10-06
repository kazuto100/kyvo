// アプリ名・ブランディングはここで一元管理（環境変数で上書き可能）
export const APP_CONFIG = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "RESELL",
  tagline: "仕入れ判断から販売・利益管理まで、これ1つ。",
  description: "中古せどりの利益・在庫・販売管理",
  timeZone: "Asia/Tokyo",
  maxImages: 10,
  imageBucket: "product-images",
} as const;
