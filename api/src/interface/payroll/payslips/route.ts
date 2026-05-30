import { IssuePayslip } from "@/application/payroll/issue-payslip"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// POST /payslips — 特権ロールが対象社員の給与明細を発行
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_code: z.string().min(1),
      period: z.string().min(1),
      base_salary: z.number(),
      allowances: z.number().default(0),
      deductions: z.number().default(0),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const payslip = await new IssuePayslip(c).run({
      viewerRole: session.role,
      employeeCode: json.employee_code,
      period: json.period,
      baseSalary: json.base_salary,
      allowances: json.allowances,
      deductions: json.deductions,
      issuedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (payslip instanceof Error) {
      throw new InternalError("failed to issue payslip")
    }

    if ("reason" in payslip) {
      if (payslip.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new NotFoundError("employee not found")
    }

    const responseBody = {
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

    return c.json(responseBody, 201)
  },
)
