const WORKFORCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

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

export class InvalidWorkforceIdError extends Error {
  readonly code = "invalid_workforce_id"

  constructor(readonly kind: WorkforceIdKind) {
    super(`invalid ${kind} id`)
    this.name = "InvalidWorkforceIdError"
  }
}

/** 永続化形式を文字列へ写した後のIDを、Company Domainのopaque IDへ復元する。 */
export function restoreWorkforceId<TKind extends WorkforceIdKind>(
  kind: TKind,
  value: string,
): WorkforceId<TKind> {
  if (!WORKFORCE_ID_PATTERN.test(value)) {
    throw new InvalidWorkforceIdError(kind)
  }

  return value as WorkforceId<TKind>
}
