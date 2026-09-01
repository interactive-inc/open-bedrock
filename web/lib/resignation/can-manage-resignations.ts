import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 退職申請の状態を代理で進める権限（resignation:manage）を持つか判定する（api の canManageResignations と同一基準）。 */
export function canManageResignations(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("resignation:manage")
}
