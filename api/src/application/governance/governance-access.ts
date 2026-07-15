import type { GovernanceMetadata } from "@/domain/governance/governance-document"
import type { Context, SessionPayload } from "@/env"
import { GovernanceRepository } from "@/infrastructure/governance/governance-repository"
import { loadCurrentOrganization } from "@/lib/org/current-organization-read-model"
import { resolveCompanyBusinessDate } from "@/lib/time/company-business-date"

export type GovernanceOrgRoleAssignee = {
  assignment_id: number | null
  employee_id: number
  employee_code: string
  employee_name: string
  department_code: string | null
  source: "manual_assignment" | "department_manager"
}

export function canManageGovernance(session: SessionPayload): boolean {
  return session.permissions.has("governance:manage")
}

export function canReadGovernance(session: SessionPayload): boolean {
  return session.permissions.has("governance:read")
}

export function canReadRestrictedGovernance(session: SessionPayload): boolean {
  return session.permissions.has("governance:read:restricted")
}

export function canReviewGovernance(session: SessionPayload): boolean {
  return session.permissions.has("governance:review")
}

export function canPublishGovernance(session: SessionPayload): boolean {
  return session.permissions.has("governance:publish")
}

export async function resolveGovernanceOrgRole(props: {
  c: Context
  code: string
}): Promise<ReadonlyArray<GovernanceOrgRoleAssignee> | Error> {
  const repository = new GovernanceRepository(props.c)
  const [role, organization] = await Promise.all([
    repository.findOrgRole(props.code),
    loadCurrentOrganization(props.c),
  ])
  if (role instanceof Error) return role
  if (organization instanceof Error) return organization
  if (role === null) return new Error("governance organization role not found")

  const employeesById = new Map(
    [...organization.employeesByCode.values()].map((employee) => [employee.id, employee] as const),
  )
  if (role.assignmentMode === "department_manager") {
    return [...organization.managerByDepartmentCode.entries()].flatMap(
      ([departmentCode, employeeCode]) => {
        const employee = organization.employeesByCode.get(employeeCode)
        return employee === undefined
          ? []
          : [
              {
                assignment_id: null,
                employee_id: employee.id,
                employee_code: employee.code,
                employee_name: employee.name,
                department_code: departmentCode,
                source: "department_manager" as const,
              },
            ]
      },
    )
  }

  const businessDate = resolveCompanyBusinessDate({
    now: props.c.env.NOW ?? new Date().toISOString(),
    timeZone: props.c.env.COMPANY_TIME_ZONE,
  })
  if (businessDate instanceof Error) return businessDate
  const assignments = await repository.listActiveManualAssignments({
    orgRoleCode: props.code,
    businessDate,
  })
  if (assignments instanceof Error) return assignments

  return assignments.flatMap((assignment) => {
    const employee = employeesById.get(assignment.employeeId)
    return employee === undefined
      ? []
      : [
          {
            assignment_id: assignment.id,
            employee_id: employee.id,
            employee_code: employee.code,
            employee_name: employee.name,
            department_code: assignment.departmentCode,
            source: "manual_assignment" as const,
          },
        ]
  })
}

export async function isGovernanceAudienceMember(props: {
  c: Context
  session: SessionPayload
  metadata: GovernanceMetadata
}): Promise<boolean | Error> {
  if (props.session.employeeStatus !== "active" && props.session.employeeStatus !== "leave") {
    return false
  }
  if (!props.metadata.audience.employee_statuses.includes(props.session.employeeStatus))
    return false
  if (props.metadata.audience.all_employees) return true

  const organization = await loadCurrentOrganization(props.c)
  if (organization instanceof Error) return organization
  const employee = [...organization.employeesByCode.values()].find(
    (candidate) => candidate.id === props.session.employeeId,
  )
  if (
    employee !== undefined &&
    employee.departmentCodes.some((code) => props.metadata.audience.department_codes.includes(code))
  ) {
    return true
  }

  const roleResults = await Promise.all(
    props.metadata.audience.org_roles.map((code) => resolveGovernanceOrgRole({ c: props.c, code })),
  )
  const error = roleResults.find((result) => result instanceof Error)
  if (error instanceof Error) return error
  return roleResults.some(
    (result) =>
      !(result instanceof Error) &&
      result.some((assignee) => assignee.employee_id === props.session.employeeId),
  )
}

export async function canReadGovernanceDocument(props: {
  c: Context
  session: SessionPayload
  metadata: GovernanceMetadata
  isDraft: boolean
}): Promise<boolean | Error> {
  if (props.isDraft) {
    if (canManageGovernance(props.session) || canPublishGovernance(props.session)) return true
    if (!canReviewGovernance(props.session)) return false
    const roleResults = await Promise.all(
      props.metadata.publication.approver_org_roles.map((code) =>
        resolveGovernanceOrgRole({ c: props.c, code }),
      ),
    )
    const error = roleResults.find((result) => result instanceof Error)
    if (error instanceof Error) return error
    return roleResults.some(
      (result) =>
        !(result instanceof Error) &&
        result.some((assignee) => assignee.employee_id === props.session.employeeId),
    )
  }
  if (!canReadGovernance(props.session)) return false
  if (
    props.metadata.classification === "public" ||
    props.metadata.classification === "internal" ||
    canReadRestrictedGovernance(props.session)
  ) {
    return true
  }
  return await isGovernanceAudienceMember(props)
}
