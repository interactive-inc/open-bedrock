import type { CertificationPermissionKey } from "@/contexts/certification/domain/catalogs/iam/certification-permission-key.catalog"

type PermissionEntry = {
  key: CertificationPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Certification が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const CERTIFICATION_PERMISSION_ENTRIES = [
  {
    key: "certification:manage",
    category: "certification",
    featureKey: "certifications",
    description: "資格・免許の台帳を管理する",
  },
  {
    key: "certification:read:all",
    category: "certification",
    featureKey: "certifications",
    description: "全社の資格・免許を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
