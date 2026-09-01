/** FamilyCareLeave が所有する権限key。 */
export const FAMILY_CARE_LEAVE_PERMISSION_KEYS = [
  "family_care_leave:manage",
  "family_care_leave:read:all",
] as const

export type FamilyCareLeavePermissionKey = (typeof FAMILY_CARE_LEAVE_PERMISSION_KEYS)[number]
