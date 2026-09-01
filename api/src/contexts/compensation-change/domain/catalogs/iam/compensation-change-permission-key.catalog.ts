/** CompensationChange が所有する権限key。 */
export const COMPENSATION_CHANGE_PERMISSION_KEYS = [
  "salary_revision:manage",
  "salary_revision:read:all",
] as const

export type CompensationChangePermissionKey = (typeof COMPENSATION_CHANGE_PERMISSION_KEYS)[number]
