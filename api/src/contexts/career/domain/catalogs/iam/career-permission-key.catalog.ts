/** Career が所有する権限key。 */
export const CAREER_PERMISSION_KEYS = ["career_posting:manage"] as const

export type CareerPermissionKey = (typeof CAREER_PERMISSION_KEYS)[number]
