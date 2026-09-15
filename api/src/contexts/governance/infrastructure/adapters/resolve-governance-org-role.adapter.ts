import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import { GovernanceAdapter } from "@/contexts/governance/infrastructure/adapters/governance.adapter"
import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyGovernanceRoleAssignmentReadAdapter } from "@/contexts/governance/infrastructure/adapters/company-governance-role-assignment-read.adapter"

export type GovernanceOrgRoleAssignee = {
  assignment_id: string | null
  employee_id: EmployeeId
  employee_code: string
  employee_name: string
  department_code: string | null
  source: "company_responsibility" | "department_manager"
}

/**
 * 組織ロール（部門長 or 手動任命）に該当する社員一覧を解決する。
 * 手動任命は会社営業日時点で有効なものだけを対象にする。
 */
export class ResolveGovernanceOrgRoleAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveGovernanceOrgRole(
    code: string,
  ): Promise<ReadonlyArray<GovernanceOrgRoleAssignee> | Error> {
    const repository = new GovernanceAdapter(this.c)
    const [role, organization] = await Promise.all([
      repository.findOrgRole(code),
      new CurrentOrganizationReadModelAdapter(this.c).loadCurrentOrganization(),
    ])
    if (role instanceof Error) return role
    if (organization instanceof Error) return organization
    if (role === null) return new Error("governance organization role not found")

    const employeesById = new Map(
      [...organization.employeesByCode.values()].map(
        (employee) => [employee.id, employee] as const,
      ),
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
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (businessDate instanceof Error) return businessDate
    const snapshot = await new CompanyGovernanceRoleAssignmentReadAdapter({
      repository: new D1CompanyResourceRepository(this.c.env.DB),
    }).read({
      organizationId: "organization:default",
      responsibilityCode: code,
      effectiveOn: restoreCalendarDate(businessDate),
    })
    if (snapshot instanceof Error) return snapshot
    return snapshot.assignees.map((assignment) => ({
      assignment_id: assignment.assignmentId,
      employee_id: assignment.employeeId as EmployeeId,
      employee_code: assignment.employeeCode,
      employee_name: assignment.employeeName,
      department_code: assignment.departmentCode,
      source: "company_responsibility" as const,
    }))
  }
}
