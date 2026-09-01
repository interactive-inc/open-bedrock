import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 休暇申請の承認・却下を行える権限（leave:approve）を持つか判定する（api の canDecideLeave と同一基準）。 */
export function canDecideLeave(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("leave:approve")
}
