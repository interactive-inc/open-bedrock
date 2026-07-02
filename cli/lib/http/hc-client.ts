import type { AppType } from "api/app"
import { hc } from "hono/client"
import { loadConfig, saveConfig } from "@/lib/config/config"
import { ApiError } from "@/lib/errors"

let refreshAttempted = false

const handleFetch = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> => {
  const response = await fetch(input, init)

  if (response.ok) {
    return response
  }

  if (response.status === 401 && refreshAttempted === false) {
    refreshAttempted = true

    const config = await loadConfig()

    if (config.refresh_token !== null) {
      const refreshed = await tryRefresh(config.base_url, config.refresh_token)

      if (refreshed !== null) {
        config.token = refreshed.access_token

        config.refresh_token = refreshed.refresh_token

        await saveConfig(config)

        const retryInit = init !== undefined ? { ...init } : {}

        const retryHeaders = new Headers(retryInit.headers)

        retryHeaders.set("Authorization", `Bearer ${config.token}`)

        retryInit.headers = retryHeaders

        return await fetch(input, retryInit)
      }
    }
  }

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

async function tryRefresh(
  baseUrl: string,
  refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const url = new URL("/auth/refresh", baseUrl)

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15_000),
    })

    if (res.ok === false) {
      return null
    }

    return (await res.json()) as { access_token: string; refresh_token: string }
  } catch {
    return null
  }
}

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
