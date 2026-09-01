import { PermissionValue } from "@system/domain/values/iam/permission.value"

/** Company roleから利用できる、System IAM最小核以外の機能権限。 */
export const SystemFeaturePermission = Object.freeze({
  ACCOUNT_MANAGE: PermissionValue.known("account:manage"),
  AUDIT_READ: PermissionValue.known("audit:read"),
  AUDIT_EXPORT: PermissionValue.known("audit:export"),
  NOTIFICATION_SEND: PermissionValue.known("notification:send"),
  BATCH_VIEW: PermissionValue.known("batch:view"),
})
