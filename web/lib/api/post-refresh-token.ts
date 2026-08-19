import type { AppType } from "api/app"
import { hc } from "hono/client"

/**
 * PATCH /system/v1/sessions を refresh_token で呼び、新しい access_token を取得する。
 * Middleware（Edge Runtime）から呼ぶため `createClient`（`next/headers` 依存）は使わず、
 * トークン不要のクライアントをその場で作る。
 */
export async function postRefreshToken(refreshToken: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:18787"

  const client = hc<AppType>(baseUrl)

  const response = await client.system.v1.sessions.$patch({
    json: { refresh_token: refreshToken },
  })

  if (response.status >= 400) {
    return new Error("failed to refresh token")
  }

  const result = await response.json()

  if ("access_token" in result === false) {
    return new Error("failed to refresh token")
  }

  return {
    access_token: result.access_token,
    refresh_token: result.refresh_token ?? null,
  }
}
