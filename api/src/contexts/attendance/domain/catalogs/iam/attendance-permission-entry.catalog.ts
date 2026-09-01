import type { AttendancePermissionKey } from "@/contexts/attendance/domain/catalogs/iam/attendance-permission-key.catalog"

type PermissionEntry = {
  key: AttendancePermissionKey
  category: string
  featureKey: string | null
  description: string
}

/**
 * Attendance が所有する権限の表示メタデータ。
 * featureKey は機能ゲートの登録名で、その App を無効にすると権限一覧から外れる。
 * null は機能ゲートの対象外を表す。
 */
export const ATTENDANCE_PERMISSION_ENTRIES = [
  {
    key: "attendance:read:all",
    category: "attendance",
    featureKey: "attendance",
    description: "全従業員の勤怠を閲覧する",
  },
  {
    key: "attendance:read:department",
    category: "attendance",
    featureKey: "attendance",
    description: "同じ部署の勤怠を閲覧する",
  },
  {
    key: "attendance:read:reports",
    category: "attendance",
    featureKey: "attendance",
    description: "レポートライン配下の勤怠を閲覧する",
  },
] satisfies ReadonlyArray<PermissionEntry>
