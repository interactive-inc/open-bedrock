/** Attendance が所有する権限key。 */
export const ATTENDANCE_PERMISSION_KEYS = [
  "attendance:read:all",
  "attendance:read:department",
  "attendance:read:reports",
] as const

export type AttendancePermissionKey = (typeof ATTENDANCE_PERMISSION_KEYS)[number]
