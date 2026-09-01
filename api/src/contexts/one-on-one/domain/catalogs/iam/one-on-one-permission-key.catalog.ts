/** OneOnOne が所有する権限key。 */
export const ONE_ON_ONE_PERMISSION_KEYS = ["oneonone:create", "oneonone:read:department"] as const

export type OneOnOnePermissionKey = (typeof ONE_ON_ONE_PERMISSION_KEYS)[number]
