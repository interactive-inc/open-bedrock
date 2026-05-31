import type { AppType } from "api/app"
import { hc } from "hono/client"
import { loadConfig } from "@/lib/config/config"

export async function createClient(baseUrlOverride?: string) {
  const config = await loadConfig()

  const headers: Record<string, string> = {}

  if (config.token !== null) {
    headers.Authorization = `Bearer ${config.token}`
  }

  return hc<AppType>(baseUrlOverride ?? config.base_url, { headers })
}

export type Client = Awaited<ReturnType<typeof createClient>>
