import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 採用（募集・応募者）を扱える権限を持つか判定する。
 * 応募者は社外個人情報のため、閲覧もこの権限に閉じる（公開しない）。
 */
export function canManageRecruitment(session: SessionPayload): boolean {
  return hasPermission(session, "recruitment:manage")
}
