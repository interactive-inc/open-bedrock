import type { WorkforceIdKind } from "@/contexts/company/domain/definitions/workforce-id.definition"

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

export class CompanyOperationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = new.target.name
  }
}

export class CompanyNotFoundError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class CompanyForbiddenError extends CompanyOperationError {
  constructor(
    message = "この操作を行う権限がありません。",
    code = "forbidden",
    options?: ErrorOptions,
  ) {
    super(message, code, options)
  }
}

export class CompanyConflictError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class CompanyValidationError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class CompanyUnavailableError extends CompanyOperationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)
  }
}

export class CompanyUnexpectedError extends CompanyOperationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "unexpected", options)
  }
}

export class CompanyTimeZoneError extends Error {
  constructor(options?: ErrorOptions) {
    super("company time zone is unavailable", options)
    this.name = "CompanyTimeZoneError"
  }
}

export class InvalidBusinessDateError extends Error {
  constructor(options?: ErrorOptions) {
    super("business date is invalid", options)
    this.name = "InvalidBusinessDateError"
  }
}

export class CompanyUniqueConstraintError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = "CompanyUniqueConstraintError"
  }
}

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

export class OrganizationalAuthorityError extends Error {
  constructor(readonly code: OrganizationalAuthorityErrorCode) {
    super(code)
    this.name = "OrganizationalAuthorityError"
  }
}

export class InvalidCalendarDateError extends Error {
  readonly code = "invalid_calendar_date"

  constructor() {
    super("invalid calendar date")
    this.name = "InvalidCalendarDateError"
  }
}

export type WorkforceStateResolutionCode =
  | "employment_state_ambiguous"
  | "status_state_missing"
  | "status_state_ambiguous"
  | "primary_assignment_state_ambiguous"

export class WorkforceStateResolutionError extends Error {
  constructor(readonly code: WorkforceStateResolutionCode) {
    super(code)
    this.name = "WorkforceStateResolutionError"
  }
}

export class InvalidWorkforceStateError extends Error {
  readonly code = "invalid_workforce_state"

  constructor() {
    super("workforce state is not canonical")
    this.name = "InvalidWorkforceStateError"
  }
}

export class InvalidOrganizationResponsibilityTypeError extends Error {
  readonly code = "invalid_organization_responsibility_type"

  constructor() {
    super("organization responsibility type is not canonical")
    this.name = "InvalidOrganizationResponsibilityTypeError"
  }
}

export class InvalidCompanyActorError extends Error {
  readonly code = "invalid_company_actor"

  constructor() {
    super("company actor is not canonical")
    this.name = "InvalidCompanyActorError"
  }
}

export class InvalidEmployeeError extends Error {
  readonly code = "invalid_employee"

  constructor() {
    super("employee profile is not canonical")
    this.name = "InvalidEmployeeError"
  }
}

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

export class InvalidWorkforceIdError extends Error {
  readonly code = "invalid_workforce_id"

  constructor(readonly kind: WorkforceIdKind) {
    super(`invalid ${kind} id`)
    this.name = "InvalidWorkforceIdError"
  }
}

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

export class WorkforceSnapshotChangedError extends Error {
  readonly code = "workforce_snapshot_changed"

  constructor() {
    super("company organization changed while workforce state was read")
    this.name = "WorkforceSnapshotChangedError"
  }
}

export class InvalidOrganizationUnitProjectionError extends Error {
  readonly code = "invalid_organization_unit_projection"

  constructor() {
    super("organization unit rows cannot be projected to the canonical model")
    this.name = "InvalidOrganizationUnitProjectionError"
  }
}

export class InvalidOrganizationPeriodProjectionError extends Error {
  readonly code = "invalid_organization_period_projection"

  constructor() {
    super("organization period rows cannot be projected to the canonical workforce model")
    this.name = "InvalidOrganizationPeriodProjectionError"
  }
}

export class InvalidOrganizationLifecycleStateError extends Error {
  readonly code = "invalid_organization_lifecycle_state"

  constructor() {
    super("organization lifecycle state is missing or invalid")
    this.name = "InvalidOrganizationLifecycleStateError"
  }
}

export class UnresolvableWorkflowStepError extends Error {
  constructor(readonly stepKey: string) {
    super(`workflow step has insufficient active approvers: ${stepKey}`)
    this.name = "UnresolvableWorkflowStepError"
    Object.freeze(this)
  }
}
