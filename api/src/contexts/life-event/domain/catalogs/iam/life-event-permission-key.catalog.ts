/** LifeEvent が所有する権限key。 */
export const LIFE_EVENT_PERMISSION_KEYS = [
  "life_event:manage",
  "life_event:read:all",
] as const

export type LifeEventPermissionKey = (typeof LIFE_EVENT_PERMISSION_KEYS)[number]
