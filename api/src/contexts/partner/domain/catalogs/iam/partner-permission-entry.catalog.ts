import type { PartnerPermissionKey } from "@/contexts/partner/domain/catalogs/iam/partner-permission-key.catalog"

type PermissionEntry = {
  key: PartnerPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Partner が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const PARTNER_PERMISSION_ENTRIES = [
  {
    key: "contract:manage",
    category: "partner",
    featureKey: "partners",
    description: "契約記録を管理する",
  },
  {
    key: "contract:read:all",
    category: "partner",
    featureKey: "partners",
    description: "全社の契約記録を横断で閲覧する",
  },
  {
    key: "partner:manage",
    category: "partner",
    featureKey: "partners",
    description: "取引先台帳を管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
