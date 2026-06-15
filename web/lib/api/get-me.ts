import { AuthError } from "@/lib/api/auth-error"
import { createClient } from "@/lib/api/hc-client"

/**
 * GET /me を session トークン付きで呼び、認証済みの本人情報を取得する。
 * 401/403（未認証・権限なし）は `AuthError` を throw し、error boundary がログインフォームに差し替える。
 * それ以外の失敗は通常の Error として throw して汎用エラーに落とす。
 */
export async function getMe() {
  const client = await createClient()

  const response = await client.me.$get()

  const status: number = response.status

  if (status === 401 || status === 403) {
    throw new AuthError()
  }

  if (status >= 400) {
    throw new Error(`failed to load me (${status})`)
  }

  return response.json()
}
