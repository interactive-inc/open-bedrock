import type { PerformanceReviewPermissionKey } from "@/contexts/performance-review/domain/catalogs/iam/performance-review-permission-key.catalog"

type PermissionEntry = {
  key: PerformanceReviewPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * PerformanceReview が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const PERFORMANCE_REVIEW_PERMISSION_ENTRIES = [
  {
    key: "evaluation:administer",
    category: "evaluation",
    featureKey: "performance-reviews",
    description: "評価テンプレート管理、評価シートの最終確定・再オープン・評価者変更を行う",
  },
  {
    key: "goal:evaluate",
    category: "goal",
    featureKey: "goals",
    description: "全社の目標を評価する",
  },
  {
    key: "goal:evaluate:reports",
    category: "goal",
    featureKey: "goals",
    description: "レポートライン配下の目標を評価する",
  },
  {
    key: "goal:read:all",
    category: "goal",
    featureKey: "goals",
    description: "全社の目標を閲覧する",
  },
  {
    key: "goal:read:department",
    category: "goal",
    featureKey: "goals",
    description: "同じ部署の目標を閲覧する",
  },
  {
    key: "goal:read:reports",
    category: "goal",
    featureKey: "goals",
    description: "レポートライン配下の目標を閲覧する",
  },
  {
    key: "review:administer",
    category: "review",
    featureKey: "performance-reviews",
    description: "評価サイクルを運営する",
  },
] satisfies ReadonlyArray<PermissionEntry>
