import type { SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"

/** メール・在籍状況・ロールを含む従業員台帳を閲覧できるか判定する。 */
export function canReadEmployees(session: SessionPayload): boolean {
  return hasPermission(session, "employee:read")
}
