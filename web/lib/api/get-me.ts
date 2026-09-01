import { AuthError } from "@/lib/api/auth-error"
import { createClient } from "@/lib/api/hc-client"
import { toPermissionKeys } from "@/lib/api/types/to-permission-keys"
import type { MeResponse } from "@/lib/api/types/auth-types"

/**
 * GET /company/current-profile を session トークン付きで呼び、認証済みの本人情報を取得する。
 * 401/403（未認証・権限なし）は `AuthError` を throw し、呼び出し元がログイン導線へ振り分ける。
 * それ以外の失敗は通常の Error として throw して汎用エラーに落とす。
 * apiはpermissionをstringで返すため、web側の権限判定が使う PermissionKey へここで一度だけ絞る。
 * apiのPERMISSION_KEYSとの一致は permission-catalog.contract.test.ts が検査する。
 */
export async function getMe(): Promise<MeResponse> {
  const client = await createClient()

  const response = await client.company["current-profile"].$get()

  const status: number = response.status

  if (status === 401 || status === 403) {
    throw new AuthError()
  }

  if (status >= 400) {
    throw new Error(`failed to load me (${status})`)
  }

  const profile = await response.json()

  return { ...profile, permissions: toPermissionKeys(profile.permissions) }
}
