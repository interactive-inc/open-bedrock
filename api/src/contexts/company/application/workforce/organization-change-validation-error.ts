export type OrganizationChangeValidationCode =
  | "empty_change"
  | "invalid_revision"
  | "invalid_operation"
  | "invalid_audit"
  | "invalid_identity"
  | "unknown_employee"
  | "invalid_organization"
  | "invalid_workforce"

export class OrganizationChangeValidationError extends Error {
  constructor(readonly code: OrganizationChangeValidationCode) {
    super(code)
    this.name = "OrganizationChangeValidationError"
  }
}
