/** Commendation が所有する権限key。 */
export const COMMENDATION_PERMISSION_KEYS = ["commendation:manage"] as const

export type CommendationPermissionKey = (typeof COMMENDATION_PERMISSION_KEYS)[number]
