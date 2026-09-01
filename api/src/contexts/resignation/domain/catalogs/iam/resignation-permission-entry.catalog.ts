import type { ResignationPermissionKey } from "@/contexts/resignation/domain/catalogs/iam/resignation-permission-key.catalog"

type PermissionEntry = {
  key: ResignationPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Resignation が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const RESIGNATION_PERMISSION_ENTRIES = [
  {
    key: "resignation:manage",
    category: "resignation",
    featureKey: null,
    description: "退職手続きの状態を代理で進める",
  },
  {
    key: "resignation:read:all",
    category: "resignation",
    featureKey: null,
    description: "全社の退職手続きを横断で閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
