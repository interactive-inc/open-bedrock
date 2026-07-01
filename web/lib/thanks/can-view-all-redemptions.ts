// api の canViewAllRedemptions と同一基準（permission ベース）。
export function canViewAllRedemptions(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("thanks_redemption:read:all")
}
