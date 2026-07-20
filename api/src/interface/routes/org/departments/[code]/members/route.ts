import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/utils/validate-code-param"
import { MAX_ORG_NODES } from "@/interface/utils/to-bounded-int"
import { zAppOrgDepartmentMemberList } from "@/lib/app-schemas"
import { loadCurrentOrganization } from "@/lib/org/current-organization-read-model"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "department")

  const organization = await loadCurrentOrganization(c)
  if (organization instanceof Error) throw new InternalError("failed to load organization")
  if (!organization.departments.some((department) => department.code === code)) {
    throw new NotFoundError("department not found")
  }
  const rows = [...organization.employeesByCode.values()]
    .flatMap((employee) => {
      const assignment = employee.assignments.find((candidate) => candidate.departmentCode === code)
      return assignment === undefined ? [] : [{ employee, assignment }]
    })
    .sort((left, right) => left.employee.code.localeCompare(right.employee.code))

  if (rows.length > MAX_ORG_NODES) {
    console.warn(`[org] department ${code} members exceeded ${MAX_ORG_NODES}; response truncated`)
  }

  const responseBody = zAppOrgDepartmentMemberList.parse(
    rows.slice(0, MAX_ORG_NODES).map((row) => ({
      employee_code: row.employee.code,
      employee_name: row.employee.name,
      position: row.assignment.position,
      manager_employee_code: row.assignment.managerEmployeeCode,
      is_manager: row.employee.code === organization.managerByDepartmentCode.get(code),
    })),
  )

  return c.json(responseBody, 200)
})
