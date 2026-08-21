import { CreateSalaryRevision } from "@/contexts/compensation-change/application/salary-revision/create-salary-revision"
import { factory } from "@/contexts/company/interface/utils/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/contexts/company/interface/utils/to-bounded-int"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { SalaryRevisionRepository } from "@/contexts/compensation-change/infrastructure/salary-revision/salary-revision.repository"
import { resolveTargetEmployeeId } from "@/contexts/company/interface/utils/resolve-target-employee-id"
import { resolveEmployeeIdFromBody } from "@/contexts/company/interface/utils/resolve-employee-id-from-body"
import { ApplicationError } from "@/lib/errors"
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppSalaryRevision, zAppSalaryRevisionList } from "@/lib/app-schemas"
import { isoDate } from "@/lib/schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/**
 * GET /salary-revisions?employee_id= — 社員の給与改定履歴（salary_revision:read:all のみ）。
 * 最機微のため self 例外は設けず、read:all を持たない者は本人分でも 403。
 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("salary_revision:read:all") === false) {
    throw new ForbiddenError()
  }

  const targetEmployeeId = await resolveTargetEmployeeId({
    c,
    employeeIdParam: c.req.query("employee_id"),
    employeeCodeParam: c.req.query("employee_code"),
    sessionEmployeeId: session.employeeId,
  })

  if (targetEmployeeId instanceof Error) {
    throw new InternalError("failed to resolve target employee")
  }

  if (targetEmployeeId === null) {
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

  const repository = new SalaryRevisionRepository(c)

  const revisions = await repository.findByEmployeeId({
    employeeId: targetEmployeeId,
    limit,
    offset,
  })

  if (revisions instanceof Error) {
    throw new InternalError("failed to load salary revisions")
  }

  const total = await repository.countByEmployeeId(targetEmployeeId)

  if (total instanceof Error) {
    throw new InternalError("failed to count salary revisions")
  }

  const responseBody = zAppSalaryRevisionList.parse({
    data: revisions.map((revision) => ({
      id: revision.id,
      employee_id: revision.employeeId,
      effective_date: revision.effectiveDate,
      previous_base_salary: revision.previousBaseSalary,
      new_base_salary: revision.newBaseSalary,
      reason: revision.reason,
      created_at: revision.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /salary-revisions — 給与改定の事実記録を追加（salary_revision:manage）。対象は employee_id / employee_code のいずれかで指定する */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        employee_id: z.number().int().positive().optional(),
        employee_code: z.string().min(1).max(200).optional(),
        effective_date: isoDate,
        previous_base_salary: z.number().int().nonnegative(),
        new_base_salary: z.number().int().nonnegative(),
        reason: z.string().max(3_000).nullable().optional(),
      })
      .refine((json) => (json.employee_id === undefined) !== (json.employee_code === undefined), {
        message: "specify exactly one of employee_id or employee_code",
      }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const targetEmployeeId = await resolveEmployeeIdFromBody({
      c,
      employeeId: json.employee_id,
      employeeCode: json.employee_code,
    })

    if (targetEmployeeId instanceof Error) {
      throw new InternalError("failed to resolve target employee")
    }

    if (targetEmployeeId === null) {
      throw new NotFoundError("employee not found")
    }

    const created = await new CreateSalaryRevision(c).run({
      session,
      employeeId: targetEmployeeId,
      effectiveDate: json.effective_date,
      previousBaseSalary: json.previous_base_salary,
      newBaseSalary: json.new_base_salary,
      reason: json.reason ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppSalaryRevision.parse({
      id: created.id,
      employee_id: created.employeeId,
      effective_date: created.effectiveDate,
      previous_base_salary: created.previousBaseSalary,
      new_base_salary: created.newBaseSalary,
      reason: created.reason,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
