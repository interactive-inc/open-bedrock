import { ApiError } from "@/lib/errors"
import { loadConfig } from "@/lib/config/load-config"
import { saveConfig } from "@/lib/config/save-config"

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  query?: Record<string, string | number | boolean | null | undefined>
  json?: unknown
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = await loadConfig()

  try {
    return await request<T>(config.base_url, config.token, path, options)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && config.refresh_token !== null) {
      const refreshed = await tryRefresh(config.base_url, config.refresh_token)

      if (refreshed !== null) {
        config.token = refreshed.access_token

        config.refresh_token = refreshed.refresh_token

        await saveConfig(config)

        return await request<T>(config.base_url, config.token, path, options)
      }
    }

    throw error
  }
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

    const json = (await res.json()) as { access_token: string; refresh_token: string }

    return json
  } catch {
    return null
  }
}

async function request<T = unknown>(
  baseUrl: string,
  token: string | null,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(path, baseUrl)

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.json !== undefined) {
    headers["content-type"] = "application/json"
  }

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  if (res.ok === false) {
    let message: string

    try {
      message = JSON.stringify(await res.json())
    } catch {
      message = await res.text()
    }

    throw new ApiError(res.status, `ERR ${res.status} ${message}`)
  }

  const contentType = res.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return (await res.json()) as T
  }

  return (await res.text()) as T
}
