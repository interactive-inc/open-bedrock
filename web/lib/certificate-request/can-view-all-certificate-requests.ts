/** 証明書発行依頼を全件（他者分含む）閲覧できる権限（certificate_request:read:all）を持つか判定する（api の canViewAllCertificateRequests と同一基準）。 */
export function canViewAllCertificateRequests(permissions: ReadonlyArray<string>): boolean {
  return permissions.includes("certificate_request:read:all")
}
