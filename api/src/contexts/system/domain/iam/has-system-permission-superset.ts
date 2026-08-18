import type { SystemAuthorization } from "@system/domain/iam/system-authorization"

/** 対象の全実効権限をactorも持つ場合だけ、権限変更を許可できる。 */
export function hasSystemPermissionSuperset(
  actor: Pick<SystemAuthorization<string | number>, "permissions">,
  targetPermissions: Iterable<string>,
): boolean {
  for (const permission of targetPermissions) {
    if (!actor.permissions.has(permission)) return false
  }
  return true
}
