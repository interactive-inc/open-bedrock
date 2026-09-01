import type { PermissionKey } from "@/lib/api/types/permission-key"

/** ライセンス・SaaS 台帳の登録・更新・解約を行える権限（license:manage）を持つか判定する（api の canManageLicenses と同一基準）。 */
export function canManageLicenses(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("license:manage")
}
