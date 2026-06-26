import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** 研修コースの作成や他者への割り当てを行える権限を持つか。 */
export function canManageTraining(session: SessionPayload): boolean {
  return hasPermission(session, "training:manage")
}
