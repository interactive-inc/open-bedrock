import type { SystemFeaturePermissionKey } from "@system/domain/catalogs/iam/system-feature-permission-key.catalog"

type PermissionEntry = {
  key: SystemFeaturePermissionKey
  category: string
  featureKey: null
  description: string
}

/**
 * System機能権限の表示メタデータ。
 * System権限は機能ゲートで止められないので featureKey は常に null にする。
 */
export const SYSTEM_FEATURE_PERMISSION_ENTRIES = [
  {
    key: "account:manage",
    category: "iam",
    featureKey: null,
    description: "アカウントを管理する(作成・停止・失効・identity)",
  },
  {
    key: "audit:export",
    category: "audit",
    featureKey: null,
    description: "監査イベントを CSV 出力する",
  },
  {
    key: "audit:read",
    category: "audit",
    featureKey: null,
    description: "監査イベントを閲覧する",
  },
  {
    key: "batch:view",
    category: "batch",
    featureKey: null,
    description: "バッチジョブを閲覧する",
  },
  {
    key: "notification:send",
    category: "notification",
    featureKey: null,
    description: "通知を送信する",
  },
] satisfies ReadonlyArray<PermissionEntry>
