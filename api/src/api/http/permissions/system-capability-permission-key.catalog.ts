/** Company roleから利用できる、System IAM最小核以外の機能権限。 */
export const SYSTEM_CAPABILITY_PERMISSION_KEYS = [
  "account:manage",
  "audit:read",
  "audit:export",
  "notification:send",
  "batch:view",
] as const
