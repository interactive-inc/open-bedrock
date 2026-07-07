/** 予算枠と消化記録の登録・更新を行える権限（budget:manage）を持つか判定する（api の canManageBudgets と同一基準）。 */
export function canManageBudgets(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("budget:manage")
}
