/** System基盤が所有するAccount・IAM・監査・通知配送・batchの権限。 */
export const SYSTEM_PERMISSION_KEYS = [
  "system:admin",
  "iam:read",
  "iam:write",
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
