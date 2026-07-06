/** 申請の承認・却下を行える権限（application:approve）を持つか判定する（api の canDecideApplication と同一基準）。 */
export function canDecideApplication(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("application:approve")
}
