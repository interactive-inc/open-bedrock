import type { PermissionKey } from "@/lib/api/types/permission-key"

/** オンボーディングテンプレートの作成・変更・削除を行える権限（onboarding:manage）を持つか判定する（api の canManageOnboarding と同一基準）。 */
export function canManageOnboarding(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("onboarding:manage")
}
