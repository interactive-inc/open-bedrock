import { SystemPermission } from "@system/domain/catalogs/iam/system-permission.catalog"
import type { PermissionValue } from "@system/domain/values/iam/permission.value"

/**
 * API が解決した権限集合を、context が特定 scope で判定するための小さな読み取り専用 checker。
 * JWT・cookie・role・製品固有の request 型は受け取らない。
 */
export function createScopedPermissionChecker(
  globalPermissions: ReadonlySet<string>,
  scopedPermissions: ReadonlyMap<string, ReadonlySet<string>>,
) {
  const canGlobally = (permission: PermissionValue): boolean =>
    globalPermissions.has(SystemPermission.SYSTEM_ADMIN.key) ||
    globalPermissions.has(permission.key)

  const canAt = (permission: PermissionValue, scopeId: string | null): boolean => {
    if (canGlobally(permission)) return true

    if (scopeId !== null) {
      return scopedPermissions.get(scopeId)?.has(permission.key) ?? false
    }

    for (const permissions of scopedPermissions.values()) {
      if (permissions.has(permission.key)) return true
    }

    return false
  }

  return Object.freeze({
    globalPermissions,
    scopedPermissions,
    can(...requestedPermissions: ReadonlyArray<PermissionValue>): boolean {
      return requestedPermissions.some((permission) => canAt(permission, null))
    },
    canAt,
    canAnyAt(permissions: ReadonlyArray<PermissionValue>, scopeId: string | null): boolean {
      return permissions.some((permission) => canAt(permission, scopeId))
    },
  })
}
