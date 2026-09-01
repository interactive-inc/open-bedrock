import type { LeavePermissionKey } from "@/contexts/leave/domain/catalogs/iam/leave-permission-key.catalog"

type PermissionEntry = {
  key: LeavePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Leave が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const LEAVE_PERMISSION_ENTRIES = [
  {
    key: "leave:approve",
    category: "leave",
    featureKey: "leave",
    description: "休暇申請を承認・却下する",
  },
  {
    key: "leave:read:all",
    category: "leave",
    featureKey: "leave",
    description: "全社の休暇申請を横断で閲覧する",
  },
  {
    key: "leave:read:department",
    category: "leave",
    featureKey: "leave",
    description: "同じ部署の休暇申請を閲覧する",
  },
  {
    key: "leave:read:reports",
    category: "leave",
    featureKey: "leave",
    description: "レポートライン配下の休暇申請を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
