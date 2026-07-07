import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 給与改定の事実記録を登録できる権限を持つか判定する。最機微のため hr / admin のみ。 */
export function canManageSalaryRevisions(session: SessionPayload): boolean {
  return hasPermission(session, "salary_revision:manage")
}
