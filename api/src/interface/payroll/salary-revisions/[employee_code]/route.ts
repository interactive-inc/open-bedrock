import { canManagePayroll } from "@/lib/payroll/payroll-access"
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateCodeParam } from "@/interface/shared/validate-code-param"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { employees, salaryRevisions } from "@/schema"
import { count, desc, eq } from "drizzle-orm"

// GET /salary-revisions/:employee_code — 特権ロールが対象社員の改定履歴を一覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (canManagePayroll(session.role) === false) {
    throw new ForbiddenError()
  }

  const employeeCode = validateCodeParam(c.req.param("employee_code"), "employee")

  const employeeRows = await c.var.database
    .select()
    .from(employees)
    .where(eq(employees.code, employeeCode))
    .limit(1)

  const employee = employeeRows.at(0)

  if (employee === undefined) {
    throw new NotFoundError("employee not found")
  }

  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const rows = await c.var.database
    .select()
    .from(salaryRevisions)
    .where(eq(salaryRevisions.employeeId, employee.id))
    .orderBy(desc(salaryRevisions.effectiveDate))
    .limit(limit)
    .offset(offset)

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(salaryRevisions)
    .where(eq(salaryRevisions.employeeId, employee.id))

  const responseBody = rows.map((row) => ({
    id: row.id,
    employee_id: row.employeeId,
    effective_date: row.effectiveDate,
    previous_base_salary: row.previousBaseSalary,
    new_base_salary: row.newBaseSalary,
    reason: row.reason,
    created_at: row.createdAt,
  }))

  return c.json({ data: responseBody, total: totalRows.at(0)?.total ?? 0 }, 200)
})
