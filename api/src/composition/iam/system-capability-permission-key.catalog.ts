/** この実装で有効な、移植可能なSystem IAM最小核以外の機能権限。 */
export const SYSTEM_CAPABILITY_PERMISSION_KEYS = [
  "iam:manage_roles",
  "iam:assign_roles",
  "account:manage",
  "audit:read",
  "audit:export",
  "notification:send",
  "batch:view",
  "api_token:manage",
  "access_review:view",
] as const
