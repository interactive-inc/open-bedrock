import { chmod, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

type EndpointTokens = {
  token: string | null
  refresh_token: string | null
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.BEDROCK_API

  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv
  }

  return "http://127.0.0.1:18787"
}

async function readTokens(baseUrl: string): Promise<EndpointTokens> {
  const file = configFile()

  let raw: string

  try {
    raw = await readFile(file, "utf8")
  } catch {
    return { token: null, refresh_token: null }
  }

  if (raw.trim() === "") {
    return { token: null, refresh_token: null }
  }

  let value: unknown

  try {
    value = JSON.parse(raw)
  } catch {
    return { token: null, refresh_token: null }
  }

  if (typeof value !== "object" || value === null) {
    return { token: null, refresh_token: null }
  }

  const endpoints = (value as Record<string, unknown>).endpoints

  if (typeof endpoints !== "object" || endpoints === null) {
    return { token: null, refresh_token: null }
  }

  const entry = (endpoints as Record<string, unknown>)[baseUrl]

  if (typeof entry !== "object" || entry === null) {
    return { token: null, refresh_token: null }
  }

  const e = entry as Record<string, unknown>
  const accessToken =
    typeof e.accessToken === "string" && e.accessToken !== "" ? e.accessToken : null
  const refreshToken =
    typeof e.refreshToken === "string" && e.refreshToken !== "" ? e.refreshToken : null

  return { token: accessToken, refresh_token: refreshToken }
}

async function tryRefresh(
  baseUrl: string,
  refreshToken: string,
): Promise<{ access_token: string } | null> {
  try {
    const url = new URL("/system/v1/sessions", baseUrl)

    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: AbortSignal.timeout(15_000),
    })

    if (res.ok === false) {
      return null
    }

    return (await res.json()) as { access_token: string }
  } catch {
    return null
  }
}

function configDir(): string {
  return process.env.BEDROCK_CONFIG_DIR ?? join(homedir(), ".config", "bedrock")
}

function configFile(): string {
  return join(configDir(), "settings.json")
}

async function writeTokens(
  baseUrl: string,
  accessToken: string,
  refreshToken: string | null,
): Promise<void> {
  const dir = configDir()
  const file = configFile()

  let root: Record<string, unknown> = { endpoints: {} }

  try {
    const raw = await readFile(file, "utf8")

    if (raw.trim() !== "") {
      const parsed = JSON.parse(raw)

      if (typeof parsed === "object" && parsed !== null) {
        root = { ...parsed }
      }
    }
  } catch {
    // File missing or corrupt — start fresh with endpoints only.
  }

  const endpoints =
    typeof root.endpoints === "object" && root.endpoints !== null
      ? { ...(root.endpoints as Record<string, unknown>) }
      : {}

  const existing =
    typeof endpoints[baseUrl] === "object" && endpoints[baseUrl] !== null
      ? { ...(endpoints[baseUrl] as Record<string, unknown>) }
      : {}

  endpoints[baseUrl] = {
    ...existing,
    accessToken,
    refreshToken: refreshToken ?? "",
  }

  root.endpoints = endpoints

  await mkdir(dir, { recursive: true, mode: 0o700 })
  await writeFile(file, `${JSON.stringify(root, null, 2)}\n`, { mode: 0o600 })
  await chmod(dir, 0o700)
  await chmod(file, 0o600)
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  query?: Record<string, string | number | boolean | null | undefined>
  json?: unknown
}

let cachedBaseUrl: string | null = null
let cachedToken: string | null = null

export async function ensureAuth(): Promise<{ baseUrl: string; token: string | null }> {
  if (cachedBaseUrl !== null) {
    return { baseUrl: cachedBaseUrl, token: cachedToken }
  }

  cachedBaseUrl = resolveBaseUrl()

  const tokens = await readTokens(cachedBaseUrl)

  cachedToken = tokens.token

  return { baseUrl: cachedBaseUrl, token: cachedToken }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { baseUrl, token } = await ensureAuth()

  const url = new URL(path, baseUrl)

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value))
    }
  }

  const headers: Record<string, string> = {}

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  if (options.json !== undefined) {
    headers["content-type"] = "application/json"
  }

  let res = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
    signal: AbortSignal.timeout(15_000),
  })

  if (res.status === 401) {
    const tokens = await readTokens(baseUrl)

    if (tokens.refresh_token !== null) {
      const refreshed = await tryRefresh(baseUrl, tokens.refresh_token)

      if (refreshed !== null) {
        cachedToken = refreshed.access_token
        headers.Authorization = `Bearer ${refreshed.access_token}`

        await writeTokens(baseUrl, refreshed.access_token, tokens.refresh_token).catch(() => {})

        res = await fetch(url, {
          method: options.method ?? "GET",
          headers,
          body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
          signal: AbortSignal.timeout(15_000),
        })
      }
    }
  }

  if (res.ok === false) {
    const contentType = res.headers.get("content-type") ?? ""
    const body = contentType.includes("application/json")
      ? JSON.stringify(await res.json())
      : await res.text()

    throw new Error(`API ${res.status}: ${body}`)
  }

  const contentType = res.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    return (await res.json()) as T
  }

  return (await res.text()) as T
}
