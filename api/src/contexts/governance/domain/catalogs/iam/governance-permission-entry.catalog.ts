import type { GovernancePermissionKey } from "@/contexts/governance/domain/catalogs/iam/governance-permission-key.catalog"

type PermissionEntry = {
  key: GovernancePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Governance が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const GOVERNANCE_PERMISSION_ENTRIES = [
  {
    key: "governance:acknowledge",
    category: "governance",
    featureKey: null,
    description: "適用対象となる規程版の確認を記録する",
  },
  {
    key: "governance:manage",
    category: "governance",
    featureKey: null,
    description: "規程原本、能力、組織ロールと割当を管理する",
  },
  {
    key: "governance:publish",
    category: "governance",
    featureKey: null,
    description: "審査要件を満たした規程版を公開する",
  },
  {
    key: "governance:read",
    category: "governance",
    featureKey: null,
    description: "公開済みの規程・手続き・統制を閲覧する",
  },
  {
    key: "governance:read:restricted",
    category: "governance",
    featureKey: null,
    description: "機密又は限定公開の規程を横断閲覧する",
  },
  {
    key: "governance:review",
    category: "governance",
    featureKey: null,
    description: "候補者となった規程版を審査する",
  },
] satisfies ReadonlyArray<PermissionEntry>
