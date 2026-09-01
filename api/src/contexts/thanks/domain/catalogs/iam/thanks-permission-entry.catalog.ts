import type { ThanksPermissionKey } from "@/contexts/thanks/domain/catalogs/iam/thanks-permission-key.catalog"

type PermissionEntry = {
  key: ThanksPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Thanks が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const THANKS_PERMISSION_ENTRIES = [
  {
    key: "thanks_redemption:approve",
    category: "thanks",
    featureKey: "thanks",
    description: "サンクスの交換申請を承認する",
  },
  {
    key: "thanks_redemption:read:all",
    category: "thanks",
    featureKey: "thanks",
    description: "全社のサンクス交換申請を横断で閲覧する",
  },
  {
    key: "thanks_reward:manage",
    category: "thanks",
    featureKey: "thanks",
    description: "サンクスの交換景品を管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
