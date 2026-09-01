/** Shift が所有する権限key。 */
export const SHIFT_PERMISSION_KEYS = [
  "shift_swap:approve",
  "shift_swap:read:all",
  "shift:manage",
] as const

export type ShiftPermissionKey = (typeof SHIFT_PERMISSION_KEYS)[number]
