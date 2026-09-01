import type { CareerPermissionKey } from "@/contexts/career/domain/catalogs/iam/career-permission-key.catalog"

type PermissionEntry = {
  key: CareerPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Career が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const CAREER_PERMISSION_ENTRIES = [
  {
    key: "career_posting:manage",
    category: "career",
    featureKey: "career",
    description: "社内公募を管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
