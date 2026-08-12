import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type {
  EmployeeId,
  EmploymentId,
  OrganizationUnitId,
  PersonnelActionId,
  SystemAccountId,
  WorkforcePeriodId,
} from "@/contexts/company/domain/workforce/workforce-id"

export const employmentStatuses = ["PRE_HIRE", "ACTIVE", "ON_LEAVE", "TERMINATED"] as const
export type EmploymentStatus = (typeof employmentStatuses)[number]

export const orgAssignmentTypes = ["PRIMARY", "CONCURRENT"] as const
export type OrgAssignmentType = (typeof orgAssignmentTypes)[number]

export const orgResponsibilityTypes = ["MANAGER"] as const
export type OrgResponsibilityType = (typeof orgResponsibilityTypes)[number]

/** revisionごとに追記される半開有効期間 [startsOn, endsOn)。 */
export type WorkforcePeriodVersion = Readonly<{
  periodId: WorkforcePeriodId
  revision: number
  startsOn: CalendarDate
  endsOn: CalendarDate | null
  isVoid: boolean
  recordedByActionId: PersonnelActionId
  recordedAt: number
}>

export type Employee = Readonly<{
  id: EmployeeId
  officialName: string
  employeeCode: string | null
  email: string | null
  phone: string | null
}>

export type EmploymentPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
  }>

export type EmploymentStatusPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    status: EmploymentStatus
  }>

export type OrgAssignmentPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    organizationUnitId: OrganizationUnitId
    assignmentType: OrgAssignmentType
    positionTitle: string | null
    managerEmployeeId: EmployeeId | null
  }>

export type OrgResponsibilityPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    organizationUnitId: OrganizationUnitId
    responsibilityType: OrgResponsibilityType
  }>

/** System Accountとの対応はCompanyが所有し、System側からEmployeeを参照しない。 */
export type AccountEmployeeLink = Readonly<{
  accountId: SystemAccountId
  employeeId: EmployeeId
}>

/** Employee profileやSystem Accountに依存しない、雇用ライフサイクルの正規化済みschedule。 */
export type WorkforceLifecycleSchedule = Readonly<{
  employeeId: EmployeeId
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmploymentStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}>

/** 1 Employeeの最新revisionだけを並べた正規化済みschedule。 */
export type WorkforceSchedule = Readonly<{
  employee: Employee
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmploymentStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
  accountLink: AccountEmployeeLink | null
}>
