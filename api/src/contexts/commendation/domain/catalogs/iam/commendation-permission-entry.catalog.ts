import type { CommendationPermissionKey } from "@/contexts/commendation/domain/catalogs/iam/commendation-permission-key.catalog"

type PermissionEntry = {
  key: CommendationPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Commendation が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const COMMENDATION_PERMISSION_ENTRIES = [
  {
    key: "commendation:manage",
    category: "employee",
    featureKey: "commendations",
    description: "表彰の記録を管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
