import type { PermissionKey } from "@/lib/auth/permission-keys"

/**
 * ロールやアカウントを復旧・再付与できる「実効管理者」に必須の権限集合。
 * ロール名ではなく、1 アカウントがロールの和集合として全て持つことを要求する。
 */
export const EFFECTIVE_ROOT_PERMISSION_KEYS = [
  "employee:assign_role",
  "iam:manage_roles",
  "iam:assign_roles",
  "account:manage",
] as const satisfies ReadonlyArray<PermissionKey>
