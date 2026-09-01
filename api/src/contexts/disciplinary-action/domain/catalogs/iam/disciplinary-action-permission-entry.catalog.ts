import type { DisciplinaryActionPermissionKey } from "@/contexts/disciplinary-action/domain/catalogs/iam/disciplinary-action-permission-key.catalog"

type PermissionEntry = {
  key: DisciplinaryActionPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * DisciplinaryAction が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const DISCIPLINARY_ACTION_PERMISSION_ENTRIES = [
  {
    key: "disciplinary_action:manage",
    category: "employee",
    featureKey: null,
    description: "懲戒の記録を管理する",
  },
  {
    key: "disciplinary_action:read:all",
    category: "employee",
    featureKey: null,
    description: "懲戒の記録を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
