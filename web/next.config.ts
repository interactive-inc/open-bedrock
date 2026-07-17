import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // portless のプロキシ経由（karte.open.localhost）で dev リソースと HMR を許可する
  allowedDevOrigins: ["karte.open.localhost"],

  // CSP is set dynamically per request in proxy.ts with a nonce for script-src.
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
        ],
      },
    ]
  },
}

export default nextConfig
