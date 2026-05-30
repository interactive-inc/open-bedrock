import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { employees, orgDepartments, orgMemberships } from "@/schema"
import { eq } from "drizzle-orm"

export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const code = c.req.param("code") ?? ""

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

  const body = rows.map((row) => ({
    employee_code: row.membership.employeeCode,
    employee_name: row.employeeName ?? "",
    position: row.position ?? null,
    manager_employee_code: row.membership.managerEmployeeCode,
    is_manager: row.membership.employeeCode === department.managerEmployeeCode,
  }))

  return c.json(body, 200)
})
