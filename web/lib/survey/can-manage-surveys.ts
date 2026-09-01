import type { PermissionKey } from "@/lib/api/types/permission-key"

/** アンケートの作成・変更・削除を行える権限（survey:manage）を持つか判定する（api の canManageSurveys と同一基準）。 */
export function canManageSurveys(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("survey:manage")
}
