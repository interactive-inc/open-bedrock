/** Recruitment が所有する権限key。 */
export const RECRUITMENT_PERMISSION_KEYS = ["recruitment:manage"] as const

export type RecruitmentPermissionKey = (typeof RECRUITMENT_PERMISSION_KEYS)[number]
