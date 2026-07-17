import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // portless のプロキシ経由（karte.open.localhost）で dev リソースと HMR を許可する
  allowedDevOrigins: ["karte.open.localhost"],

  // Codex のローカル in-app browser は sandboxed frame から Server Action を送るため
  // Origin が `null` になる。production では許可せず、通常の same-origin 検査を維持する。
  experimental: {
    serverActions:
      process.env.NODE_ENV === "development" ? { allowedOrigins: ["null"] } : undefined,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js の streaming SSR と hydration はインライン script($RC、__next_f)で
              // 動くため 'unsafe-inline' が必須。script-src 'self' 単独だと全画面が
              // スケルトンのまま止まる。nonce ベース CSP への移行は別課題。
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                : "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  silent: process.env.CI !== "true",
  tunnelRoute: "/monitoring",
})
