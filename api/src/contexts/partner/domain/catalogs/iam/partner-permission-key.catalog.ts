/** Partner が所有する権限key。 */
export const PARTNER_PERMISSION_KEYS = [
  "contract:manage",
  "contract:read:all",
  "partner:manage",
] as const

export type PartnerPermissionKey = (typeof PARTNER_PERMISSION_KEYS)[number]
