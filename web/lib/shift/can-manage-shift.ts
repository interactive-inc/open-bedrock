// api の canManageShift と同一基準（permission ベース）。
export function canManageShift(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("shift:manage")
}
