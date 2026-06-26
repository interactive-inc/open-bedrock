import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/** オンボーディングテンプレートの作成・変更・削除を行える権限を持つか。 */
export function canManageOnboarding(session: SessionPayload): boolean {
  return hasPermission(session, "onboarding:manage")
}
