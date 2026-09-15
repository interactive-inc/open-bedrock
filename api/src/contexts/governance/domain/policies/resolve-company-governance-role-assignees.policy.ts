import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"

export type CompanyGovernanceRoleEmployee = Readonly<{
  id: string
  code: string
  name: string
}>

export type CompanyGovernanceRoleDepartment = Readonly<{
  id: string
  code: string
}>

export type CompanyGovernanceRoleAssignee = Readonly<{
  assignmentId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  departmentCode: string | null
}>

type Input = Readonly<{
  responsibilityCode: string
  resources: ReadonlyArray<CompanyResourceEntity>
  employees: ReadonlyArray<CompanyGovernanceRoleEmployee>
  departments: ReadonlyArray<CompanyGovernanceRoleDepartment>
}>

/** Companyの同一snapshotから規程上の責務を担う従業員を厳密に復元する。 */
export function resolveCompanyGovernanceRoleAssignees(
  input: Input,
): ReadonlyArray<CompanyGovernanceRoleAssignee> | Error {
  const responsibilities = input.resources.filter(
    (resource) =>
      resource.type === "responsibility" && resource.readText("code") === input.responsibilityCode,
  )
  if (responsibilities.length !== 1) {
    return new Error("company governance responsibility is missing or ambiguous")
  }
  const responsibility = responsibilities[0]
  if (responsibility === undefined) {
    return new Error("company governance responsibility is missing or ambiguous")
  }

  const employees = new Map(input.employees.map((employee) => [employee.id, employee]))
  const departments = new Map(input.departments.map((department) => [department.id, department]))
  const resources = new Map(
    input.resources.map((resource) => [`${resource.type}\u0000${resource.id}`, resource]),
  )
  const assignees: CompanyGovernanceRoleAssignee[] = []

  for (const assignment of input.resources.filter(
    (resource) =>
      resource.type === "responsibility-assignment" &&
      resource.readText("responsibilityId") === responsibility.id,
  )) {
    if (assignment.readText("holderType") !== "employee") {
      return new Error("company governance responsibility holder is not an employee")
    }
    const employeeId = assignment.readText("holderId")
    const authorityScopeId = assignment.readNullableText("authorityScopeId")
    if (employeeId === null || authorityScopeId === undefined) {
      return new Error("company governance responsibility reference is invalid")
    }
    const employee = employees.get(employeeId)
    if (employee === undefined) {
      return new Error("company governance responsibility employee is missing")
    }

    let departmentCode: string | null = null
    if (authorityScopeId !== null) {
      const scope = resources.get(`authority-scope\u0000${authorityScopeId}`)
      if (scope === undefined || scope.readText("scopeType") !== "organization-unit") {
        return new Error("company governance responsibility scope is invalid")
      }
      const departmentId = scope.readText("scopeId")
      if (departmentId === null) {
        return new Error("company governance responsibility scope is invalid")
      }
      const department = departments.get(departmentId)
      if (department === undefined) {
        return new Error("company governance responsibility department is missing")
      }
      departmentCode = department.code
    }

    assignees.push({
      assignmentId: assignment.id,
      employeeId,
      employeeCode: employee.code,
      employeeName: employee.name,
      departmentCode,
    })
  }

  return assignees.toSorted(
    (left, right) =>
      left.employeeCode.localeCompare(right.employeeCode) ||
      left.assignmentId.localeCompare(right.assignmentId),
  )
}
