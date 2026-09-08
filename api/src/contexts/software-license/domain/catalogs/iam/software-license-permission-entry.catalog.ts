import type { SoftwareLicensePermissionKey } from "@/contexts/software-license/domain/catalogs/iam/software-license-permission-key.catalog"

type PermissionEntry = {
  key: SoftwareLicensePermissionKey
  category: string
  name: string
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
    name: "サービス利用台帳の管理",
    description: "サービスの契約・プランと利用者の割当を管理できます。",
  },
  {
    key: "license:read:all",
    category: "license",
    featureKey: "software-licenses",
    name: "サービス利用台帳の閲覧",
    description: "サービスの契約・プランと利用者の割当を閲覧できます。",
  },
] satisfies ReadonlyArray<PermissionEntry>
