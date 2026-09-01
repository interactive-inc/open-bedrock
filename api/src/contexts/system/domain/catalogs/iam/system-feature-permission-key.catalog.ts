/** Company roleから利用できる、System IAM最小核以外の機能権限。 */
export const SYSTEM_FEATURE_PERMISSION_KEYS = [
  "account:manage",
  "audit:read",
  "audit:export",
  "notification:send",
  "batch:view",
] as const

export type SystemFeaturePermissionKey = (typeof SYSTEM_FEATURE_PERMISSION_KEYS)[number]
