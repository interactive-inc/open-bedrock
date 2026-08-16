import type { Context } from "@/env"
import { GovernanceRepository } from "@/contexts/governance/infrastructure/governance-repository"
import { loadCurrentOrganization } from "@/contexts/company/application/organization/current-organization-read-model"
import { resolveCompanyBusinessDate } from "@/lib/time/resolve-company-business-date"

export type GovernanceOrgRoleAssignee = {
  assignment_id: number | null
  employee_id: number
  employee_code: string
  employee_name: string
  department_code: string | null
  source: "manual_assignment" | "department_manager"
}

/**
 * 組織ロール（部門長 or 手動任命）に該当する社員一覧を解決する。
 * 手動任命は会社営業日時点で有効なものだけを対象にする。
 */
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
