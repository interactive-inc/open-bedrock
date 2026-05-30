import { factory } from "@/lib/factory"
import { payslipSearchQueryInputSchema } from "@/interface/payroll/payslips/me/payslip-search-query-input-schema"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { payslips } from "@/schema"
import { BadRequestError, UnauthorizedError } from "@/interface/lib/errors"
import { and, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

// GET /payslips/me — 本人の給与明細一覧（period で絞り込み可能）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const parsed = payslipSearchQueryInputSchema.safeParse({
    period: c.req.query("period"),
  })

  if (parsed.success === false) {
    throw new BadRequestError("invalid query")
  }

  const conditions: Array<SQL> = [eq(payslips.employeeId, session.employeeId)]

  if (parsed.data.period !== undefined) {
    conditions.push(eq(payslips.period, parsed.data.period))
  }

  const rows = await c.var.database
    .select()
    .from(payslips)
    .where(and(...conditions))

  const responseBody = rows.map((row) => ({
    id: row.id,
    employee_id: row.employeeId,
    period: row.period,
    base_salary: row.baseSalary,
    allowances: row.allowances,
    deductions: row.deductions,
    net_pay: row.netPay,
    issued_at: row.issuedAt,
    status: row.status,
  }))

  return c.json(responseBody, 200)
})
