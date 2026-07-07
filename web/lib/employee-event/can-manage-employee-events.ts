/** 異動・在籍イベントの登録を行える権限（employee_event:manage）を持つか判定する（api の canManageEmployeeEvents と同一基準）。 */
export function canManageEmployeeEvents(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("employee_event:manage")
}
