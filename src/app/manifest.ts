import type { MetadataRoute } from "next";

/** What a phone needs to offer "Add to home screen": a name, colours, and an icon that is not a screenshot. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FutureRealm SMS",
    short_name: "FutureRealm",
    description: "School management for Nigerian schools — attendance, results, fees and messages that keep working offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7faf8",
    theme_color: "#0d2315",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
