import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 社内公募の作成・変更・削除を行える権限（career_posting:manage）を持つか判定する（api の canManageCareerPostings と同一基準）。 */
export function canManageCareerPostings(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("career_posting:manage")
}
