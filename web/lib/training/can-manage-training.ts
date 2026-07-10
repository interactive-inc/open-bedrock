// api の canManageTraining と同一基準（permission ベース）。
export function canManageTraining(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("training:manage")
}
