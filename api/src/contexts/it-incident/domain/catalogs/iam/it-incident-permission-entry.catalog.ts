import type { ItIncidentPermissionKey } from "@/contexts/it-incident/domain/catalogs/iam/it-incident-permission-key.catalog"

type PermissionEntry = {
  key: ItIncidentPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * ItIncident が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const IT_INCIDENT_PERMISSION_ENTRIES = [
  {
    key: "it_incident:manage",
    category: "license",
    featureKey: "it-incidents",
    description: "インシデント記録を管理する",
  },
  {
    key: "it_incident:read:all",
    category: "license",
    featureKey: "it-incidents",
    description: "全社のインシデント記録を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
