import type { HealthCheckupPermissionKey } from "@/contexts/health-checkup/domain/catalogs/iam/health-checkup-permission-key.catalog"

type PermissionEntry = {
  key: HealthCheckupPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * HealthCheckup が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const HEALTH_CHECKUP_PERMISSION_ENTRIES = [
  {
    key: "health_checkup:manage",
    category: "health",
    featureKey: "health-checkups",
    description: "健康診断の実施記録を管理する",
  },
  {
    key: "health_checkup:read:all",
    category: "health",
    featureKey: "health-checkups",
    description: "全社の健康診断の実施記録を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
