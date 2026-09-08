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
  {
    key: "system:work:read",
    category: "work",
    featureKey: null,
    description: "参加する作業と成果を閲覧する",
  },
  { key: "system:work:create", category: "work", featureKey: null, description: "作業を依頼する" },
  {
    key: "system:work:perform",
    category: "work",
    featureKey: null,
    description: "作業を受領し成果を提出する",
  },
  {
    key: "system:work:review",
    category: "work",
    featureKey: null,
    description: "人が成果を確認し承認・差戻しする",
  },
  {
    key: "system:work:manage",
    category: "work",
    featureKey: null,
    description: "責任を引き継ぎ作業を中止する",
  },
] satisfies ReadonlyArray<PermissionEntry>
