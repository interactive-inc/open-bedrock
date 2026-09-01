import type { RegulationPermissionKey } from "@/contexts/regulation/domain/catalogs/iam/regulation-permission-key.catalog"

type PermissionEntry = {
  key: RegulationPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Regulation が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const REGULATION_PERMISSION_ENTRIES = [
  {
    key: "regulation:manage",
    category: "regulation",
    featureKey: null,
    description: "規程集を管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
