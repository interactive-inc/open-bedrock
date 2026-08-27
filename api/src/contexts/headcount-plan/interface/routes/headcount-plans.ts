import { CreateHeadcountPlan } from "@/contexts/headcount-plan/application/create-headcount-plan"
import { readActiveHeadcount } from "@/contexts/company/infrastructure/organization/read-active-headcount.repository"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zAppHeadcountPlan, zAppHeadcountPlanList } from "@/lib/app-schemas"
import { HeadcountPlanRepository } from "@/contexts/headcount-plan/infrastructure/repositories/headcount-plan.repository"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/** GET /headcount-plans?fiscal_year= — 人員計画一覧に実在籍数(active)を添える（headcount_plan:read:all）。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("headcount_plan:read:all") === false) {
    throw new ForbiddenError()
  }

  const fiscalYearRaw = c.req.query("fiscal_year")

  const fiscalYear =
    fiscalYearRaw === undefined || fiscalYearRaw === "" ? null : Number(fiscalYearRaw)

  if (fiscalYear !== null && Number.isInteger(fiscalYear) === false) {
    const responseBody = zAppHeadcountPlanList.parse({ data: [], total: 0 })

    return c.json(responseBody, 200)
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

  const repository = new HeadcountPlanRepository(c)

  const plans = await repository.list({ fiscalYear, limit, offset })

  if (plans instanceof Error) {
    throw new InternalError("failed to load headcount plans")
  }

  const total = await repository.count(fiscalYear)

  if (total instanceof Error) {
    throw new InternalError("failed to count headcount plans")
  }

  const activeHeadcount = await readActiveHeadcount(c)
  if (activeHeadcount instanceof ApplicationError) {
    throw toHttpException(activeHeadcount)
  }
  if (activeHeadcount instanceof Error) {
    throw new InternalError("failed to count active employees")
  }

  const responseBody = zAppHeadcountPlanList.parse({
    data: plans.map((plan) => ({
      id: plan.id,
      fiscal_year: plan.fiscalYear,
      department_code: plan.departmentCode,
      planned_count: plan.plannedCount,
      actual_count:
        plan.departmentCode === null
          ? activeHeadcount.total
          : (activeHeadcount.byOrganizationUnitCode.get(plan.departmentCode) ?? 0),
      note: plan.note,
      created_at: plan.createdAt,
    })),
    total,
  })

  return c.json(responseBody, 200)
})

// @authorization service - session を application service に渡して判定する
/** POST /headcount-plans — 人員計画を登録（headcount_plan:manage）。年度・部署の重複は 409。 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      fiscal_year: z.number().int(),
      department_code: z.string().max(100).nullable().optional(),
      planned_count: z.number().int().min(0),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateHeadcountPlan(c).run({
      session,
      fiscalYear: json.fiscal_year,
      departmentCode: json.department_code ?? null,
      plannedCount: json.planned_count,
      note: json.note ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppHeadcountPlan.parse({
      id: created.id,
      fiscal_year: created.fiscalYear,
      department_code: created.departmentCode,
      planned_count: created.plannedCount,
      actual_count: 0,
      note: created.note,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
