import type { WorkAccidentPermissionKey } from "@/contexts/work-accident/domain/catalogs/iam/work-accident-permission-key.catalog"

type PermissionEntry = {
  key: WorkAccidentPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * WorkAccident が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const WORK_ACCIDENT_PERMISSION_ENTRIES = [
  {
    key: "work_accident:manage",
    category: "health",
    featureKey: "work-accidents",
    description: "労災・事故の発生記録を管理する",
  },
  {
    key: "work_accident:read:all",
    category: "health",
    featureKey: "work-accidents",
    description: "全社の労災・事故記録を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
