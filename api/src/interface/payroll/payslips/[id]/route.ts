import { CancelPayslip } from "@/application/payroll/cancel-payslip"
import { CorrectPayslip } from "@/application/payroll/correct-payslip"
import { canManagePayroll } from "@/domain/payroll/payroll-access"
import { Payslip } from "@/domain/payroll/payslip"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { yearMonth } from "@/lib/schemas"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { payslips } from "@/schema"
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { z } from "zod"

const payslipIdSchema = z.coerce.number().int()

// 給与明細をレスポンス用の snake_case に整形する。
function toResponseBody(payslip: Payslip) {
  return {
    id: payslip.id,
    employee_id: payslip.employeeId,
    period: payslip.period,
    base_salary: payslip.baseSalary,
    allowances: payslip.allowances,
    deductions: payslip.deductions,
    net_pay: payslip.netPay,
    issued_at: payslip.issuedAt,
    status: payslip.status,
  }
}

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

// PUT /payslips/:id — 特権ロールが給与明細の期間と金額を訂正（金額は渡された値で記録）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        period: yearMonth,
        base_salary: z.number().int().nonnegative().safe(),
        allowances: z.number().int().nonnegative().safe(),
        deductions: z.number().int().nonnegative().safe(),
        net_pay: z.number().int().nonnegative().safe(),
      })
      .refine(
        (input) => input.net_pay === input.base_salary + input.allowances - input.deductions,
        {
          message: "net_pay must equal base_salary + allowances - deductions",
        },
      ),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const payslipId = payslipIdSchema.safeParse(c.req.param("id"))

    if (payslipId.success === false) {
      throw new BadRequestError("invalid payslip id")
    }

    const json = c.req.valid("json")

    const payslip = await new CorrectPayslip(c).run({
      viewerRole: session.role,
      payslipId: payslipId.data,
      period: json.period,
      baseSalary: json.base_salary,
      allowances: json.allowances,
      deductions: json.deductions,
      netPay: json.net_pay,
    })

    if (payslip instanceof Error) {
      throw new InternalError("failed to correct payslip")
    }

    if (payslip instanceof Payslip === false) {
      if (payslip.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new NotFoundError("payslip not found")
    }

    return c.json(toResponseBody(payslip), 200)
  },
)

// DELETE /payslips/:id — 特権ロールが給与明細を取り消す（記録の削除のみ）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const payslipId = payslipIdSchema.safeParse(c.req.param("id"))

  if (payslipId.success === false) {
    throw new BadRequestError("invalid payslip id")
  }

  const result = await new CancelPayslip(c).run({
    viewerRole: session.role,
    payslipId: payslipId.data,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel payslip")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "payslip_not_found") {
    throw new NotFoundError("payslip not found")
  }

  return c.body(null, 204)
})
