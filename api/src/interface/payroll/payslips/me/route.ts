import { factory } from "@/lib/factory"
import { payslipSearchQueryInputSchema } from "@/interface/payroll/payslips/me/payslip-search-query-input-schema"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
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
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  })

  if (parsed.success === false) {
    throw new BadRequestError("invalid query")
  }

  const limit = toBoundedInt({
    raw: parsed.data.limit,
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })

  const offset = toBoundedInt({
    raw: parsed.data.offset,
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })

  const conditions: Array<SQL> = [eq(payslips.employeeId, session.employeeId)]

  if (parsed.data.period !== undefined) {
    conditions.push(eq(payslips.period, parsed.data.period))
  }

  const rows = await c.var.database
    .select()
    .from(payslips)
    .where(and(...conditions))
    .limit(limit)
    .offset(offset)

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
