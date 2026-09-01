import type { SurveyPermissionKey } from "@/contexts/survey/domain/catalogs/iam/survey-permission-key.catalog"

type PermissionEntry = {
  key: SurveyPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Survey が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const SURVEY_PERMISSION_ENTRIES = [
  {
    key: "survey:manage",
    category: "survey",
    featureKey: "surveys",
    description: "アンケートを管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
