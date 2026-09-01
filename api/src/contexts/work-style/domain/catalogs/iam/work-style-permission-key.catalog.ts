/** WorkStyle が所有する権限key。 */
export const WORK_STYLE_PERMISSION_KEYS = [
  "work_style:manage",
  "work_style:read:all",
] as const

export type WorkStylePermissionKey = (typeof WORK_STYLE_PERMISSION_KEYS)[number]
