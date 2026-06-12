import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // portless のプロキシ経由（karte.open.localhost）で dev リソースと HMR を許可する
  allowedDevOrigins: ["karte.open.localhost"],
}

export default nextConfig
