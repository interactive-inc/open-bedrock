declare const workforceIdBrand: unique symbol

export type WorkforceIdKind =
  | "employee"
  | "employment"
  | "organization_unit"
  | "period"
  | "personnel_action"
  | "system_account"

export type WorkforceId<TKind extends WorkforceIdKind> = string & {
  readonly [workforceIdBrand]: TKind
}

export type EmployeeId = WorkforceId<"employee">
export type EmploymentId = WorkforceId<"employment">
export type OrganizationUnitId = WorkforceId<"organization_unit">
export type WorkforcePeriodId = WorkforceId<"period">
export type PersonnelActionId = WorkforceId<"personnel_action">
export type SystemAccountId = WorkforceId<"system_account">
