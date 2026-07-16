import type { SessionPayload } from "@/env"
import { hasPermission } from "@/lib/auth/has-permission"

export function canManageLifecycleMigration(session: SessionPayload): boolean {
  return hasPermission(session, "batch:view") && hasPermission(session, "employee:lifecycle:apply")
}
