import type { AssetPermissionKey } from "@/contexts/asset/domain/catalogs/iam/asset-permission-key.catalog"

type PermissionEntry = {
  key: AssetPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Asset が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const ASSET_PERMISSION_ENTRIES = [
  {
    key: "asset:manage",
    category: "asset",
    featureKey: "assets",
    description: "資産を管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
