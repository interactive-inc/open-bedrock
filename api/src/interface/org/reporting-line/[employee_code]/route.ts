import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { employees, orgMemberships } from "@/schema"
import { eq } from "drizzle-orm"

type ReportingLineNode = {
  employee_code: string
  employee_name: string
  department_code: string | null
  position: string | null
  depth: number
}

// GET /org/reporting-line/:employee_code — 本人から上位へのレポートライン
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const employeeCode = c.req.param("employee_code") ?? ""

  const body: Array<ReportingLineNode> = []

  const visited = new Set<string>()

  let currentCode: string | null = employeeCode

  while (currentCode !== null && visited.has(currentCode) === false) {
    visited.add(currentCode)

    const rows = await c.var.database
      .select({
        membership: orgMemberships,
        employeeName: employees.name,
        position: employees.position,
      })
      .from(orgMemberships)
      .leftJoin(employees, eq(employees.code, orgMemberships.employeeCode))
      .where(eq(orgMemberships.employeeCode, currentCode))
      .limit(1)

    const row = rows.at(0)

    if (row === undefined) {
      if (body.length === 0) {
        throw new NotFoundError("membership not found")
      }

      return c.json(body, 200)
    }

    body.push({
      employee_code: currentCode,
      employee_name: row.employeeName ?? "",
      department_code: row.membership.departmentCode,
      position: row.position ?? null,
      depth: body.length,
    })

    currentCode = row.membership.managerEmployeeCode
  }

  return c.json(body, 200)
})
