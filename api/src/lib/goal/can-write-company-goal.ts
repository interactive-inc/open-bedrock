import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 全社目標を作成・編集できるか判定する。全社目標は評価サイクルの運営者(review:administer)が扱う。
 */
export function canWriteCompanyGoal(session: SessionPayload): boolean {
  return hasPermission(session, "review:administer")
}
