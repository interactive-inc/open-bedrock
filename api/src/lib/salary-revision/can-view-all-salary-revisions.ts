import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 給与改定記録を閲覧できるか判定する。最機微のため self 例外は設けず、
 * salary_revision:read:all を持つ者（hr / admin）だけが本人分を含めて閲覧できる。
 */
export function canViewAllSalaryRevisions(session: SessionPayload): boolean {
  return hasPermission(session, "salary_revision:read:all")
}
