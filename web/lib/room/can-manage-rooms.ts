// api の canManageRooms と同一基準（permission ベース）。
export function canManageRooms(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("room:manage")
}
