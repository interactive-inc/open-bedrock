export type AccountEmployeeLinkResolutionCode =
  | "account_link_ambiguous"
  | "account_link_account_mismatch"
  | "account_link_employee_mismatch"

export class AccountEmployeeLinkResolutionError extends Error {
  constructor(readonly code: AccountEmployeeLinkResolutionCode) {
    super(code)
    this.name = "AccountEmployeeLinkResolutionError"
  }
}
