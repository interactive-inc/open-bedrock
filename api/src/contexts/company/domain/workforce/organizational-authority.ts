import type { CalendarDate } from "@/contexts/company/domain/workforce/calendar-date"
import type { WorkforceStateAt } from "@/contexts/company/domain/workforce/resolve-workforce-state"
import type { AccountEmployeeLink } from "@/contexts/company/domain/workforce/workforce-schedule"
import type { OrgResponsibilityType } from "@/contexts/company/domain/workforce/workforce-schedule"
import type {
  EmployeeId,
  OrganizationUnitId,
  SystemAccountId,
  WorkforcePeriodId,
} from "@/contexts/company/domain/workforce/workforce-id"

export type OrganizationalAuthorityCriterion =
  | Readonly<{ kind: "employee"; employeeId: EmployeeId }>
  | Readonly<{ kind: "direct_manager" }>
  | Readonly<{ kind: "subject_organization_manager" }>
  | Readonly<{
      kind: "target_organization_manager"
      organizationUnitId: OrganizationUnitId
    }>
  | Readonly<{
      kind: "responsibility"
      responsibilityType: OrgResponsibilityType
      organizationUnitId: OrganizationUnitId | null
    }>
  | Readonly<{ kind: "management_chain" }>

/** 一回の資格解決で固定したCompany組織の時点。 */
export type OrganizationalAuthoritySnapshot = Readonly<{
  schemaVersion: 1
  source: "legacy" | "lifecycle"
  asOf: CalendarDate
  organizationRevision: number | null
}>

export type OrganizationalAuthorityAssignmentEvidence = Readonly<{
  employeeId: EmployeeId
  managerEmployeeId: EmployeeId | null
  organizationUnitId: OrganizationUnitId
  assignmentPeriodId: WorkforcePeriodId
  assignmentRevision: number
  asOf: CalendarDate
}>

export type OrganizationalAuthorityManagementEdgeEvidence =
  OrganizationalAuthorityAssignmentEvidence &
    Readonly<{
      managerEmployeeId: EmployeeId
    }>

export type OrganizationalAuthorityResponsibilityEvidence = Readonly<{
  employeeId: EmployeeId
  organizationUnitId: OrganizationUnitId
  responsibilityType: OrgResponsibilityType
  responsibilityPeriodId: WorkforcePeriodId
  responsibilityRevision: number
  asOf: CalendarDate
}>

/** 保存済みsnapshotで解釈できる、Company固有の判別可能な資格証拠。 */
export type OrganizationalAuthorityEvidence =
  | Readonly<{ kind: "employee"; employeeId: EmployeeId }>
  | Readonly<{
      kind: "direct_manager"
      assignment: OrganizationalAuthorityManagementEdgeEvidence
    }>
  | Readonly<{
      kind: "organization_manager"
      scope: "subject" | "target"
      subjectAssignment: OrganizationalAuthorityAssignmentEvidence | null
      responsibility: OrganizationalAuthorityResponsibilityEvidence
    }>
  | Readonly<{
      kind: "responsibility"
      responsibility: OrganizationalAuthorityResponsibilityEvidence
    }>
  | Readonly<{
      kind: "management_chain"
      path: ReadonlyArray<OrganizationalAuthorityManagementEdgeEvidence>
    }>

export type OrganizationalAuthorityQualification = Readonly<{
  criterionIndex: number
  evidence: OrganizationalAuthorityEvidence
}>

export type OrganizationalAuthorityCandidate = Readonly<{
  employeeId: EmployeeId
  accountId: SystemAccountId
  qualification: OrganizationalAuthorityQualification
}>

export type OrganizationalAuthorityResolution = Readonly<{
  snapshot: OrganizationalAuthoritySnapshot
  candidates: ReadonlyArray<OrganizationalAuthorityCandidate>
}>

/** DBやruntimeから解決済みのCompany事実だけを純粋resolverへ渡す。 */
export type OrganizationalAuthorityProjection = Readonly<{
  snapshot: OrganizationalAuthoritySnapshot
  subjectEmployeeId: EmployeeId | null
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  states: ReadonlyArray<WorkforceStateAt>
  accountLinks: ReadonlyArray<AccountEmployeeLink>
}>
