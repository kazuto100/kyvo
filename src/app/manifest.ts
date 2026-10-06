import type { MetadataRoute } from "next";
import { APP_CONFIG } from "@/config/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_CONFIG.name} — ${APP_CONFIG.description}`,
    short_name: APP_CONFIG.name,
    description: APP_CONFIG.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafb",
    theme_color: "#fafafb",
    lang: "ja",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/pwa-icons/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icons/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "クイック仕入れ", url: "/products/quick" },
      { name: "仕入れ判断", url: "/simulator" },
    ],
  };
}
