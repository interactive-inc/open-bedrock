import type { PermissionKey } from "@/lib/auth/permission-keys"
import type { SessionPayload } from "@/env"

// 認可の唯一の判定関数。session に DB 解決済みの permissions Set を見るだけの純関数。
// can-* はこの関数に委譲し、role 文字列ではなく permission キーで判定する。
// 未知キー・解決失敗は permissions に無いので deny(fail-closed)。

/**
 * session が指定 permission を持つか判定する。
 */
export function hasPermission(session: SessionPayload, key: PermissionKey): boolean {
  return session.permissions.has(key)
}
