import { SYSTEM_PERMISSION_KEYS } from "@system/domain/catalogs/iam/system-permission-key.catalog"
import { SYSTEM_CAPABILITY_PERMISSION_KEYS } from "@/api/http/permissions/system-capability-permission-key.catalog"

type SystemPermissionKey =
  | (typeof SYSTEM_PERMISSION_KEYS)[number]
  | (typeof SYSTEM_CAPABILITY_PERMISSION_KEYS)[number]

type PermissionEntry = {
  key: SystemPermissionKey
  category: string
  description: string
}

/**
 * System権限の表示メタデータ。
 * Systemのcontextはlockで固定するため、表示用のメタデータだけをここが持つ。
 * System権限は機能ゲートで止められないので featureKey を持たない。
 */
export const SYSTEM_PERMISSION_ENTRIES = [
  {
    key: "iam:read",
    category: "iam",
    description: "IAM設定と割当を閲覧する",
  },
  {
    key: "iam:write",
    category: "iam",
    description: "IAM設定と割当を変更する",
  },
  {
    key: "system:admin",
    category: "system",
    description: "System全体を管理する",
  },
  {
    key: "account:manage",
    category: "iam",
    description: "アカウントを管理する(作成・停止・失効・identity)",
  },
  {
    key: "audit:export",
    category: "audit",
    description: "監査イベントを CSV 出力する",
  },
  {
    key: "audit:read",
    category: "audit",
    description: "監査イベントを閲覧する",
  },
  {
    key: "batch:view",
    category: "batch",
    description: "バッチジョブを閲覧する",
  },
  {
    key: "notification:send",
    category: "notification",
    description: "通知を送信する",
  },
] satisfies ReadonlyArray<PermissionEntry>
