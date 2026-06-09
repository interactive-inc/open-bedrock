import type { AppType } from "api/app"
import { hc } from "hono/client"
import { loadConfig } from "@/lib/config/config"
import { ApiError } from "@/lib/errors"

// 4xx/5xx を ApiError として投げ、index.ts の onError で stderr + exit 1 に落とす。
// hc は 4xx/5xx でも throw しないため、各ルートが response.ok を確認しないと
// API エラーがサイレントに成功扱いされていた。全ルートで一括して弾くために fetch を包む。
// 成功時は本文を読まずそのまま返すので、呼び出し側の json() と二重読みにならない。
const fetchOrThrow: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)

  if (response.ok) {
    return response
  }

  const detail = await response.text()

  throw new ApiError(
    response.status,
    detail === "" ? `ERR ${response.status}` : `ERR ${response.status} ${detail}`,
  )
}

export async function createClient(baseUrlOverride?: string) {
  const config = await loadConfig()

  const headers: Record<string, string> = {}

  if (config.token !== null) {
    headers.Authorization = `Bearer ${config.token}`
  }

  return hc<AppType>(baseUrlOverride ?? config.base_url, { headers, fetch: fetchOrThrow })
}

export type Client = Awaited<ReturnType<typeof createClient>>
