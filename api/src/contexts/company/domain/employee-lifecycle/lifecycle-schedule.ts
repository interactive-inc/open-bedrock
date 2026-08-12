/** 有効日と訂正revisionを持つCompany従業員ライフサイクルの共通期間。 */
export type LifecyclePeriodBase = {
  periodId: string
  revision: number
  startsOn: string
  endsOn: string | null
  isVoid: boolean
  recordedByActionId: string
  recordedAt: number
}

export type EmploymentPeriod = LifecyclePeriodBase & {
  employeeId: number
}

export type EmployeeStatusPeriod = LifecyclePeriodBase & {
  employmentPeriodId: string
  employeeId: number
  status: "active" | "leave"
}

export type OrgAssignmentPeriod = LifecyclePeriodBase & {
  employmentPeriodId: string
  employeeId: number
  departmentCode: string
  assignmentType: "primary" | "concurrent"
  positionTitle: string | null
  managerEmployeeId: number | null
}

export type OrgResponsibilityPeriod = LifecyclePeriodBase & {
  departmentCode: string
  responsibilityType: "department_manager"
  employeeId: number
}

export type LifecycleSchedule = {
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmployeeStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}

export type EmploymentVersionMutation = {
  periodType: "employment"
  before: EmploymentPeriod | null
  after: EmploymentPeriod
}

export type EmployeeStatusVersionMutation = {
  periodType: "status"
  before: EmployeeStatusPeriod | null
  after: EmployeeStatusPeriod
}

export type OrgAssignmentVersionMutation = {
  periodType: "assignment"
  before: OrgAssignmentPeriod | null
  after: OrgAssignmentPeriod
}

export type OrgResponsibilityVersionMutation = {
  periodType: "responsibility"
  before: OrgResponsibilityPeriod | null
  after: OrgResponsibilityPeriod
}

export type LifecycleVersionMutation =
  | EmploymentVersionMutation
  | EmployeeStatusVersionMutation
  | OrgAssignmentVersionMutation
  | OrgResponsibilityVersionMutation
