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

  // 全 memberships + employees を 1 クエリで一括取得し、メモリ上でツリーを走査する。
  // 組織規模が小さい前提（数百人以下）なので全件取得で十分速い。
  const allRows = await c.var.database
    .select({
      membership: orgMemberships,
      employeeName: employees.name,
      position: employees.position,
    })
    .from(orgMemberships)
    .leftJoin(employees, eq(employees.code, orgMemberships.employeeCode))

  // employeeCode → row の lookup map を構築
  const lookup = new Map<
    string,
    {
      employeeName: string | null
      departmentCode: string
      position: string | null
      managerEmployeeCode: string | null
    }
  >()

  for (const row of allRows) {
    lookup.set(row.membership.employeeCode, {
      employeeName: row.employeeName,
      departmentCode: row.membership.departmentCode,
      position: row.position,
      managerEmployeeCode: row.membership.managerEmployeeCode,
    })
  }

  const entry = lookup.get(employeeCode)

  if (entry === undefined) {
    throw new NotFoundError("membership not found")
  }

  const body: Array<ReportingLineNode> = []

  const visited = new Set<string>()

  let currentCode: string | null = employeeCode

  while (currentCode !== null && visited.has(currentCode) === false) {
    const row = lookup.get(currentCode)

    if (row === undefined) {
      break
    }

    visited.add(currentCode)

    body.push({
      employee_code: currentCode,
      employee_name: row.employeeName ?? "",
      department_code: row.departmentCode,
      position: row.position ?? null,
      depth: body.length,
    })

    currentCode = row.managerEmployeeCode
  }

  return c.json(body, 200)
})
