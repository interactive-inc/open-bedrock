import type { SystemAuthorization } from "@/contexts/company/application/system-compatibility/iam/system-authorization"

/**
 * 対象の実効権限をすべて実行者も持つか判定する。
 * 高権限ロール・アカウントを下位権限の管理者が破壊／乗っ取りできないための共通境界。
 */
export function hasPermissionSuperset(
  session: Pick<SystemAuthorization<string | number>, "permissions">,
  targetPermissions: Iterable<string>,
): boolean {
  for (const permission of targetPermissions) {
    if (session.permissions.has(permission) === false) {
      return false
    }
  }

  return true
}
