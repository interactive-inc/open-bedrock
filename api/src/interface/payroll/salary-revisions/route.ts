import { CreateSalaryRevision } from "@/application/payroll/create-salary-revision"
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

// POST /salary-revisions — 特権ロールが前回基本給を解決しつつ給与改定を作成
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      employee_code: z.string().min(1),
      effective_date: z.string().min(1),
      new_base_salary: z.number(),
      reason: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const revision = await new CreateSalaryRevision(c).run({
      viewerRole: session.role,
      employeeCode: json.employee_code,
      effectiveDate: json.effective_date,
      newBaseSalary: json.new_base_salary,
      reason: json.reason ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (revision instanceof Error) {
      throw new InternalError("failed to create salary revision")
    }

    if ("id" in revision === false) {
      if (revision.reason === "forbidden") {
        throw new ForbiddenError()
      }

      throw new NotFoundError("employee not found")
    }

    const responseBody = {
      id: revision.id,
      employee_id: revision.employeeId,
      effective_date: revision.effectiveDate,
      previous_base_salary: revision.previousBaseSalary,
      new_base_salary: revision.newBaseSalary,
      reason: revision.reason,
      created_at: revision.createdAt,
    }

    return c.json(responseBody, 201)
  },
)
