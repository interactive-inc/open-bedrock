import { hasPermission } from "@/lib/auth/has-permission"
import type { SessionPayload } from "@/env"

/**
 * 部署予算を登録・更新・削除できるか判定する。予算の記録と横断集計の閲覧を担う
 * hr / admin などに付与する `budget:manage` を見る
 */
export function canManageBudgets(session: SessionPayload): boolean {
  return hasPermission(session, "budget:manage")
}
