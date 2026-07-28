/** requested role が存在しないか、付与者の実効権限を超えたため batch を中止したことを表すエラー。 */
export class RoleAssignmentGuardError extends Error {
  constructor(options?: ErrorOptions) {
    super("role assignment was rejected", options)
    this.name = "RoleAssignmentGuardError"
  }
}
