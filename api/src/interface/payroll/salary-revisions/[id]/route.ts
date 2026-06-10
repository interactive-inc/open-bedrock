import { CancelSalaryRevision } from "@/application/payroll/cancel-salary-revision"
import { CorrectSalaryRevision } from "@/application/payroll/correct-salary-revision"
import { SalaryRevision } from "@/domain/payroll/salary-revision"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// 給与改定をレスポンス用の snake_case に整形する。
function toResponseBody(salaryRevision: SalaryRevision) {
  return {
    id: salaryRevision.id,
    employee_id: salaryRevision.employeeId,
    effective_date: salaryRevision.effectiveDate,
    previous_base_salary: salaryRevision.previousBaseSalary,
    new_base_salary: salaryRevision.newBaseSalary,
    reason: salaryRevision.reason,
    created_at: salaryRevision.createdAt,
  }
}

// PUT /salary-revisions/:id — 特権ロールが既存の給与改定を訂正（id で特定）
export const PUT = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      effective_date: isoDate,
      new_base_salary: z.number().int().nonnegative().safe(),
      reason: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const salaryRevisionId = validateIntParam(c.req.param("id"), "salary revision")

    const json = c.req.valid("json")

    const corrected = await new CorrectSalaryRevision(c).run({
      viewerRole: session.role,
      salaryRevisionId,
      effectiveDate: json.effective_date,
      newBaseSalary: json.new_base_salary,
      reason: json.reason ?? null,
    })

    if (corrected instanceof Error) {
      throw new InternalError("failed to correct salary revision")
    }

    // SalaryRevision も reason フィールドを持つため "reason" in で判別できない。instanceof で判別する。
    if (corrected instanceof SalaryRevision) {
      return c.json(toResponseBody(corrected), 200)
    }

    if (corrected.reason === "forbidden") {
      throw new ForbiddenError()
    }

    throw new NotFoundError("salary revision not found")
  },
)

// DELETE /salary-revisions/:id — 特権ロールが既存の給与改定を取消（id で特定）
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const salaryRevisionId = validateIntParam(c.req.param("id"), "salary revision")

  const result = await new CancelSalaryRevision(c).run({
    viewerRole: session.role,
    salaryRevisionId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to cancel salary revision")
  }

  if (result.reason === "forbidden") {
    throw new ForbiddenError()
  }

  if (result.reason === "salary_revision_not_found") {
    throw new NotFoundError("salary revision not found")
  }

  return c.body(null, 204)
})
