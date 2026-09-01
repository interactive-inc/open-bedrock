/** Resignation が所有する権限key。 */
export const RESIGNATION_PERMISSION_KEYS = [
  "resignation:manage",
  "resignation:read:all",
] as const

export type ResignationPermissionKey = (typeof RESIGNATION_PERMISSION_KEYS)[number]
