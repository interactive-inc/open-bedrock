/** Regulation が所有する権限key。 */
export const REGULATION_PERMISSION_KEYS = [
  "regulation:manage",
] as const

export type RegulationPermissionKey = (typeof REGULATION_PERMISSION_KEYS)[number]
