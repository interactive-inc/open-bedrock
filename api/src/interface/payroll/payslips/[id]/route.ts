import { canManagePayroll } from "@/domain/payroll/payroll-access"
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { payslips } from "@/schema"
import { eq } from "drizzle-orm"
import { z } from "zod"

const payslipIdSchema = z.coerce.number().int()

// GET /payslips/:id — 本人または特権ロールが指定した給与明細を閲覧
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const payslipId = payslipIdSchema.safeParse(c.req.param("id"))

  if (payslipId.success === false) {
    throw new BadRequestError("invalid payslip id")
  }

  const rows = await c.var.database
    .select()
    .from(payslips)
    .where(eq(payslips.id, payslipId.data))
    .limit(1)

  const row = rows.at(0)

  if (row === undefined) {
    throw new NotFoundError("payslip not found")
  }

  const isOwner = row.employeeId === session.employeeId

  if (isOwner === false && canManagePayroll(session.role) === false) {
    throw new ForbiddenError()
  }

  const responseBody = {
    id: row.id,
    employee_id: row.employeeId,
    period: row.period,
    base_salary: row.baseSalary,
    allowances: row.allowances,
    deductions: row.deductions,
    net_pay: row.netPay,
    issued_at: row.issuedAt,
    status: row.status,
  }

  return c.json(responseBody, 200)
})
