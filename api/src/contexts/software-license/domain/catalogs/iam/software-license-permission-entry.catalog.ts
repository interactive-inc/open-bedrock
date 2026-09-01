import type { SoftwareLicensePermissionKey } from "@/contexts/software-license/domain/catalogs/iam/software-license-permission-key.catalog"

type PermissionEntry = {
  key: SoftwareLicensePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * SoftwareLicense が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const SOFTWARE_LICENSE_PERMISSION_ENTRIES = [
  {
    key: "license:manage",
    category: "license",
    featureKey: "software-licenses",
    description: "ライセンス・SaaS台帳を管理する",
  },
  {
    key: "license:read:all",
    category: "license",
    featureKey: "software-licenses",
    description: "ライセンス・SaaS台帳を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
