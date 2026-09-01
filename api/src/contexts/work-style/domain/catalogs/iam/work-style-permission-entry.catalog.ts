import type { WorkStylePermissionKey } from "@/contexts/work-style/domain/catalogs/iam/work-style-permission-key.catalog"

type PermissionEntry = {
  key: WorkStylePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * WorkStyle が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const WORK_STYLE_PERMISSION_ENTRIES = [
  {
    key: "work_style:manage",
    category: "attendance",
    featureKey: null,
    description: "勤務形態の属性を管理する",
  },
  {
    key: "work_style:read:all",
    category: "attendance",
    featureKey: null,
    description: "全社の勤務形態の属性を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
