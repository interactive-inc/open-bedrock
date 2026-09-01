import type { CompensationChangePermissionKey } from "@/contexts/compensation-change/domain/catalogs/iam/compensation-change-permission-key.catalog"

type PermissionEntry = {
  key: CompensationChangePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * CompensationChange が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const COMPENSATION_CHANGE_PERMISSION_ENTRIES = [
  {
    key: "salary_revision:manage",
    category: "salary",
    featureKey: null,
    description: "給与改定の事実記録を管理する",
  },
  {
    key: "salary_revision:read:all",
    category: "salary",
    featureKey: null,
    description: "全社の給与改定記録を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
