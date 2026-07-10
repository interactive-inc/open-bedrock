// api の canDecideLeave と同一基準（permission ベース）。
export function canDecideLeave(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("leave:approve")
}
