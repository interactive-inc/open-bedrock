export type OrganizationalAuthorityErrorCode =
  | "organizational_authority_snapshot_invalid"
  | "organizational_authority_employee_duplicate"
  | "organizational_authority_state_as_of_mismatch"
  | "organizational_authority_state_invalid"
  | "organizational_authority_period_invalid"
  | "organizational_authority_period_duplicate"
  | "organizational_authority_employee_reference_missing"
  | "organizational_authority_subject_missing"
  | "organizational_authority_account_employee_duplicate"
  | "organizational_authority_account_duplicate"
  | "organizational_authority_account_employee_missing"
  | "organizational_authority_manager_cycle"

/** 壊れたCompany projectionを候補ゼロと混同しないためのfail-closed error。 */
export class OrganizationalAuthorityError extends Error {
  constructor(readonly code: OrganizationalAuthorityErrorCode) {
    super(code)
    this.name = "OrganizationalAuthorityError"
  }
}
