import { PermissionValue } from "@/domain/system/iam/permission.value"

/** System自身が所有する権限語彙。利用側の語彙は各context側で定義する。 */
export const SystemPermission = Object.freeze({
  SYSTEM_ADMIN: PermissionValue.known("system:admin"),
  IAM_READ: PermissionValue.known("iam:read"),
  IAM_WRITE: PermissionValue.known("iam:write"),
  IAM_MANAGE_ROLES: PermissionValue.known("iam:manage_roles"),
  IAM_ASSIGN_ROLES: PermissionValue.known("iam:assign_roles"),
  ACCOUNT_MANAGE: PermissionValue.known("account:manage"),
  AUDIT_READ: PermissionValue.known("audit:read"),
  AUDIT_EXPORT: PermissionValue.known("audit:export"),
  NOTIFICATION_SEND: PermissionValue.known("notification:send"),
  BATCH_VIEW: PermissionValue.known("batch:view"),
  API_TOKEN_MANAGE: PermissionValue.known("api_token:manage"),
  ACCESS_REVIEW_VIEW: PermissionValue.known("access_review:view"),
})
