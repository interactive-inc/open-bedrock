import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import { MAX_ORG_NODES } from "@/interface/shared/to-bounded-int"
import { zAppOrgDepartmentMemberList } from "@/lib/app-schemas"
import { employees, orgDepartments, orgMemberships } from "@/schema"
import { eq } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = validateCodeParam(c.req.param("code"), "department")

  const departmentRows = await c.var.database
    .select()
    .from(orgDepartments)
    .where(eq(orgDepartments.code, code))
    .limit(1)

  const department = departmentRows.at(0)

  if (department === undefined) {
    throw new NotFoundError("department not found")
  }

  const rows = await c.var.database
    .select({
      membership: orgMemberships,
      employeeName: employees.name,
      position: employees.position,
    })
    .from(orgMemberships)
    .leftJoin(employees, eq(employees.code, orgMemberships.employeeCode))
    .where(eq(orgMemberships.departmentCode, code))
    .limit(MAX_ORG_NODES + 1)

  if (rows.length > MAX_ORG_NODES) {
    console.warn(`[org] department ${code} members exceeded ${MAX_ORG_NODES}; response truncated`)
  }

  const responseBody = zAppOrgDepartmentMemberList.parse(
    rows.slice(0, MAX_ORG_NODES).map((row) => ({
      employee_code: row.membership.employeeCode,
      employee_name: row.employeeName ?? "",
      position: row.position ?? null,
      manager_employee_code: row.membership.managerEmployeeCode,
      is_manager: row.membership.employeeCode === department.managerEmployeeCode,
    })),
  )

  return c.json(responseBody, 200)
})
