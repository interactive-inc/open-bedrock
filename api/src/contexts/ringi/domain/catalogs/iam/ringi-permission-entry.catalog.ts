import type { RingiPermissionKey } from "@/contexts/ringi/domain/catalogs/iam/ringi-permission-key.catalog"

type PermissionEntry = {
  key: RingiPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Ringi が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const RINGI_PERMISSION_ENTRIES = [
  {
    key: "ringi:read:all",
    category: "ringi",
    featureKey: "ringi",
    description: "全社の稟議を横断で閲覧する",
  },
  {
    key: "ringi:approve",
    category: "ringi",
    featureKey: "ringi",
    description: "会社上の判断資格に従って稟議を承認し、決裁結果を確定する",
  },
  {
    key: "ringi:submit",
    category: "ringi",
    featureKey: "ringi",
    description: "会社の承認規程へ稟議を提出する",
  },
] satisfies ReadonlyArray<PermissionEntry>
