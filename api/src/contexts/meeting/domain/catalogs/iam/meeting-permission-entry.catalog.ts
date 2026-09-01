import type { MeetingPermissionKey } from "@/contexts/meeting/domain/catalogs/iam/meeting-permission-key.catalog"

type PermissionEntry = {
  key: MeetingPermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Meeting が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const MEETING_PERMISSION_ENTRIES = [
  {
    key: "decision:manage",
    category: "decision",
    featureKey: "meetings",
    description: "会社の意思決定記録を記録・更新する",
  },
  {
    key: "meeting:manage",
    category: "meeting",
    featureKey: "meetings",
    description: "会議体マスタを管理する",
  },
] satisfies ReadonlyArray<PermissionEntry>
