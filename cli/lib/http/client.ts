import { ApiError } from "@/lib/errors"
import { loadConfig } from "@/lib/config/config"

// 設定のトークンを Authorization に載せて API を叩き、
// 4xx/5xx は HTTPException に変換してハンドラの外（index.ts）で stderr に出す。
type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  query?: Record<string, string | number | boolean | null | undefined>
  json?: unknown
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = await loadConfig()
  return request<T>(config.base_url, config.token, path, options)
}

export async function request<T = unknown>(
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
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.json !== undefined) headers["content-type"] = "application/json"

  const res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
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
