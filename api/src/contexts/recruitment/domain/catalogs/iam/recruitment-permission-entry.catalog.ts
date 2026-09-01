import type { RecruitmentPermissionKey } from "@/contexts/recruitment/domain/catalogs/iam/recruitment-permission-key.catalog"

type PermissionEntry = {
  key: RecruitmentPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Recruitment が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const RECRUITMENT_PERMISSION_ENTRIES = [
  {
    key: "recruitment:manage",
    category: "recruitment",
    featureKey: "recruitment",
    description: "採用(応募者管理)を扱う",
  },
] satisfies ReadonlyArray<PermissionEntry>
