import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 申請テンプレートの作成・変更・削除を行える権限を持つか判定する純粋関数。 */
export function canManageApplicationTemplates(session: SessionPayload): boolean {
  return hasPermission(session, "application_template:manage")
}
