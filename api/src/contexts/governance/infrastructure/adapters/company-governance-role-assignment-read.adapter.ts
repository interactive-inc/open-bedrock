import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { resolveCompanyGovernanceRoleAssignees } from "@/contexts/governance/domain/policies/resolve-company-governance-role-assignees.policy"

type Context = Readonly<{
  repository: Pick<CompanyResourceRepository, "findMany">
}>

export type CompanyGovernanceRoleAssignmentSnapshot = Readonly<{
  organizationRevision: number
  assignees: ReadonlyArray<{
    assignmentId: string
    employeeId: string
    employeeCode: string
    employeeName: string
    departmentCode: string | null
  }>
}>

/** Company公開資源の一つの会社版から、規程で使う責務任命を読む。 */
export class CompanyGovernanceRoleAssignmentReadAdapter {
  private static readonly resourceTypes: ReadonlyArray<CompanyResourceEntity["type"]> = [
    "person",
    "employee",
    "organization-unit",
    "responsibility",
    "authority-scope",
    "responsibility-assignment",
  ]

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async read(props: {
    organizationId: string
    responsibilityCode: string
    effectiveOn: CalendarDate
    organizationRevision?: number
  }): Promise<CompanyGovernanceRoleAssignmentSnapshot | Error> {
    const read = await this.c.repository.findMany({
      organizationId: props.organizationId,
      types: CompanyGovernanceRoleAssignmentReadAdapter.resourceTypes,
      effectiveOn: props.effectiveOn,
      organizationRevision: props.organizationRevision,
    })
    if (!read.ok) return read.cause instanceof Error ? read.cause : new Error("Company unavailable")

    const resources = new Map(
      read.resources.map((resource) => [`${resource.type}\u0000${resource.id}`, resource]),
    )
    const employees = []
    for (const employee of read.resources.filter((resource) => resource.type === "employee")) {
      const personId = employee.readText("personId")
      const employeeCode = employee.readNullableText("employeeCode")
      if (personId === null || employeeCode === null || employeeCode === undefined) continue
      const person = resources.get(`person\u0000${personId}`)
      const officialName = person?.readText("officialName") ?? null
      if (officialName === null) continue
      employees.push({ id: employee.id, code: employeeCode, name: officialName })
    }
    const departments = []
    for (const unit of read.resources.filter((resource) => resource.type === "organization-unit")) {
      const organizationUnitId = unit.readText("organizationUnitId")
      const code = unit.readText("code")
      if (organizationUnitId === null || code === null) {
        return new Error("Company governance organization unit is invalid")
      }
      departments.push({ id: organizationUnitId, code })
    }
    const assignees = resolveCompanyGovernanceRoleAssignees({
      responsibilityCode: props.responsibilityCode,
      resources: read.resources,
      employees,
      departments,
    })
    return assignees instanceof Error
      ? assignees
      : { organizationRevision: read.organizationRevision, assignees }
  }
}
