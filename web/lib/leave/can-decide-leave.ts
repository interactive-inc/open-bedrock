/** 休暇申請の承認・却下を行える権限（leave:approve）を持つか判定する（api の canDecideLeave と同一基準）。 */
export function canDecideLeave(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("leave:approve")
}
