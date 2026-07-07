import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 資格マスタ・保有記録を登録／更新／削除できる権限（certification:manage）を持つか判定する。
 */
export function canManageCertifications(session: SessionPayload): boolean {
  return hasPermission(session, "certification:manage")
}
