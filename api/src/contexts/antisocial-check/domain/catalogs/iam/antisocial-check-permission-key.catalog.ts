/** AntisocialCheck が所有する権限key。 */
export const ANTISOCIAL_CHECK_PERMISSION_KEYS = ["antisocial_check:manage"] as const

export type AntisocialCheckPermissionKey = (typeof ANTISOCIAL_CHECK_PERMISSION_KEYS)[number]
