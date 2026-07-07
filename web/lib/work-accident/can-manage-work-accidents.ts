/** 労災・事故の発生記録を登録／クローズできる権限（work_accident:manage）を持つか判定する（api の canManageWorkAccidents と同一基準）。 */
export function canManageWorkAccidents(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("work_accident:manage")
}
