/** 産休・育休・介護休業の申出の状態を代理で進める権限（family_care_leave:manage）を持つか判定する（api の canManageFamilyCareLeaves と同一基準）。 */
export function canManageFamilyCareLeaves(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("family_care_leave:manage")
}
