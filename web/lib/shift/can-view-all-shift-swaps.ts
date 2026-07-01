// api の canViewAllShiftSwaps と同一基準（permission ベース）。
export function canViewAllShiftSwaps(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("shift_swap:read:all")
}
