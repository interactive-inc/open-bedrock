// application:read:all を持つかで判定する（api の canViewAllApplications と同一基準）。
// role 名ではなく /me が返す permissions 配列を見て判定する。
export function canViewAllApplications(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("application:read:all")
}
