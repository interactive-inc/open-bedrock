/** WorkAccident が所有する権限key。 */
export const WORK_ACCIDENT_PERMISSION_KEYS = [
  "work_accident:manage",
  "work_accident:read:all",
] as const

export type WorkAccidentPermissionKey = (typeof WORK_ACCIDENT_PERMISSION_KEYS)[number]
