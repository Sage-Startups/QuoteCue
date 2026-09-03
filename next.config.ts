import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer", "sharp", "pg", "@prisma/adapter-pg"],
  images: {
    // All user files are served through authenticated proxy routes or presigned URLs.
    remotePatterns: [],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
