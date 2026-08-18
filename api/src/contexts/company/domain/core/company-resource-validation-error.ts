export type CompanyResourceValidationCode =
  | "invalid_identifier"
  | "invalid_revision"
  | "invalid_period"
  | "invalid_attributes"
  | "invalid_resource"
  | "invalid_organization"
  | "invalid_change"
  | "invalid_query"

export class CompanyResourceValidationError extends Error {
  constructor(readonly code: CompanyResourceValidationCode) {
    super(code)
    this.name = "CompanyResourceValidationError"
  }
}
