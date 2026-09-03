import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QuoteCue AI",
    short_name: "QuoteCue",
    description: "From enquiry to professional quote in minutes.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#0f1f3d",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
