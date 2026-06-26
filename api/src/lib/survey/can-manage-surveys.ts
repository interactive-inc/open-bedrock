import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** アンケートの作成・変更・削除を行える権限を持つか判定する純粋関数。 */
export function canManageSurveys(session: SessionPayload): boolean {
  return hasPermission(session, "survey:manage")
}
