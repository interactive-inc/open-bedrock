/** Leave が所有する権限key。 */
export const LEAVE_PERMISSION_KEYS = [
  "leave:approve",
  "leave:read:all",
  "leave:read:department",
  "leave:read:reports",
] as const

export type LeavePermissionKey = (typeof LEAVE_PERMISSION_KEYS)[number]
