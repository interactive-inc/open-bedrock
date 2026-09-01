import type { OnboardingPermissionKey } from "@/contexts/onboarding/domain/catalogs/iam/onboarding-permission-key.catalog"

type PermissionEntry = {
  key: OnboardingPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Onboarding が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const ONBOARDING_PERMISSION_ENTRIES = [
  {
    key: "onboarding:manage",
    category: "onboarding",
    featureKey: null,
    description: "オンボーディングを管理する",
  },
  {
    key: "onboarding:view:all",
    category: "onboarding",
    featureKey: null,
    description: "全従業員のオンボーディングを閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
