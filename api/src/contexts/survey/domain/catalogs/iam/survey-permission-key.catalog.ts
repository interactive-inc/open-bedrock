/** Survey が所有する権限key。 */
export const SURVEY_PERMISSION_KEYS = [
  "survey:manage",
] as const

export type SurveyPermissionKey = (typeof SURVEY_PERMISSION_KEYS)[number]
