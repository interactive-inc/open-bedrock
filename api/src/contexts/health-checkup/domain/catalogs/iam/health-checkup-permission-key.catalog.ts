/** HealthCheckup が所有する権限key。 */
export const HEALTH_CHECKUP_PERMISSION_KEYS = [
  "health_checkup:manage",
  "health_checkup:read:all",
] as const

export type HealthCheckupPermissionKey = (typeof HEALTH_CHECKUP_PERMISSION_KEYS)[number]
