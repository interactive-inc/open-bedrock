import type { OneOnOnePermissionKey } from "@/contexts/one-on-one/domain/catalogs/iam/one-on-one-permission-key.catalog"

type PermissionEntry = {
  key: OneOnOnePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * OneOnOne が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const ONE_ON_ONE_PERMISSION_ENTRIES = [
  {
    key: "oneonone:create",
    category: "oneonone",
    featureKey: "one-on-ones",
    description: "1on1 を作成する",
  },
  {
    key: "oneonone:read:department",
    category: "oneonone",
    featureKey: "one-on-ones",
    description: "同じ部署の 1on1 を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
