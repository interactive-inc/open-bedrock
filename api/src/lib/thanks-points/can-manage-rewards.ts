import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 交換カタログの管理（登録・更新・無効化）が可能な権限を持つか判定する純粋関数。
 */
export function canManageRewards(session: SessionPayload): boolean {
  return hasPermission(session, "thanks_reward:manage")
}
