/** Ringi が所有する権限key。 */
export const RINGI_PERMISSION_KEYS = [
  "ringi:read:all",
] as const

export type RingiPermissionKey = (typeof RINGI_PERMISSION_KEYS)[number]
