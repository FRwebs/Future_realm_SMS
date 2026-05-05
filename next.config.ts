import type { NextConfig } from "next";

const isVercelRuntime = process.env.VERCEL === "1";
const externalNestApiUrl = process.env.NEST_API_URL?.trim();
const localNestApiUrl = externalNestApiUrl || "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async rewrites() {
    if (isVercelRuntime) {
      return [];
    }

    if (!externalNestApiUrl && process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${localNestApiUrl}/api/:path*`
      }
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**"
      }
    ]
  }
};

export default nextConfig;
