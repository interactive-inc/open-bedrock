import type { HeadcountPlanPermissionKey } from "@/contexts/headcount-plan/domain/catalogs/iam/headcount-plan-permission-key.catalog"

type PermissionEntry = {
  key: HeadcountPlanPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * HeadcountPlan が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const HEADCOUNT_PLAN_PERMISSION_ENTRIES = [
  {
    key: "headcount_plan:manage",
    category: "headcount",
    featureKey: "headcount-plans",
    description: "人員計画を管理する",
  },
  {
    key: "headcount_plan:read:all",
    category: "headcount",
    featureKey: "headcount-plans",
    description: "人員計画を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
