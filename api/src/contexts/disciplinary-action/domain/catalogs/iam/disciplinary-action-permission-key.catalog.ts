/** DisciplinaryAction が所有する権限key。 */
export const DISCIPLINARY_ACTION_PERMISSION_KEYS = [
  "disciplinary_action:manage",
  "disciplinary_action:read:all",
] as const

export type DisciplinaryActionPermissionKey = (typeof DISCIPLINARY_ACTION_PERMISSION_KEYS)[number]
