import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const isVercelRuntime = process.env.VERCEL === "1";
const externalNestApiUrl = process.env.NEST_API_URL?.trim();
const localNestApiUrl = externalNestApiUrl || "http://127.0.0.1:4000";

const isDev = process.env.NODE_ENV === "development";

// The Content-Security-Policy is built per request, with a nonce, in src/middleware.ts; the headers below are the ones that never vary.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  typedRoutes: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be fetched fresh, or an update could never reach a device that already has it.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
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

// `ANALYZE=true npm run build:web` writes an interactive map of what is in each bundle (see `npm run analyze`).
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

// Translations are read per request from src/i18n/request.ts, without changing any route.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const configured = withNextIntl(withBundleAnalyzer(nextConfig));

/**
 * Readable error reports: when a Sentry auth token is present at build time (CI / the host's build settings), the build uploads its source
 * maps to Sentry and removes them from what is served, so a stack trace names the real file and line. Without the token nothing changes —
 * no upload, no extra build step. Set SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT to switch it on.
 */
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(configured, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      // The build does not report to Sentry about itself.
      telemetry: false,
    })
  : configured;
