/** 貸与品予約を全件（他者分含む）閲覧できる権限（rental:read:all）を持つか判定する（api の canViewAllRentalReservations と同一基準）。 */
export function canViewAllRentalReservations(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("rental:read:all")
}
