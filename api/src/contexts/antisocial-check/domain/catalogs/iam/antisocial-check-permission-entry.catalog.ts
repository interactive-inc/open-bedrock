import type { AntisocialCheckPermissionKey } from "@/contexts/antisocial-check/domain/catalogs/iam/antisocial-check-permission-key.catalog"

type PermissionEntry = {
  key: AntisocialCheckPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * AntisocialCheck が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const ANTISOCIAL_CHECK_PERMISSION_ENTRIES = [
  {
    key: "antisocial_check:manage",
    category: "antisocial-check",
    featureKey: "antisocial-checks",
    description: "反社チェックを管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
