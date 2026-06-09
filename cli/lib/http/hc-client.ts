import type { AppType } from "api/app"
import { hc } from "hono/client"
import { loadConfig } from "@/lib/config/config"
import { ApiError } from "@/lib/errors"

// 4xx/5xx を ApiError として投げ、index.ts の onError で stderr + exit 1 に落とす。
// hc は 4xx/5xx でも throw しないため、各ルートが response.ok を確認しないと
// API エラーがサイレントに成功扱いされていた。全ルートで一括して弾くために fetch を包む。
// 成功時は本文を読まずそのまま返すので、呼び出し側の json() と二重読みにならない。
const handleFetch = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> => {
  const response = await fetch(input, init)

  if (response.ok) {
    return response
  }

  // 本文は一度だけ読む。JSON ならコンパクトに整形し、それ以外は生テキストを使う
  // （ensureOk と同じ見え方に揃える）。
  const raw = await response.text()

  let detail: string

  try {
    detail = JSON.stringify(JSON.parse(raw))
  } catch {
    detail = raw
  }

  throw new ApiError(
    response.status,
    detail === "" ? `ERR ${response.status}` : `ERR ${response.status} ${detail}`,
  )
}

// bun の typeof fetch は静的メソッド preconnect を要求するため、実 fetch のものを引き継いで
// hc の fetch オプション（typeof fetch）に代入可能にする。
const fetchOrThrow: typeof fetch = Object.assign(handleFetch, { preconnect: fetch.preconnect })

export async function createClient(baseUrlOverride?: string) {
  const config = await loadConfig()

  const headers: Record<string, string> = {}

  if (config.token !== null) {
    headers.Authorization = `Bearer ${config.token}`
  }

  return hc<AppType>(baseUrlOverride ?? config.base_url, { headers, fetch: fetchOrThrow })
}

export type Client = Awaited<ReturnType<typeof createClient>>
