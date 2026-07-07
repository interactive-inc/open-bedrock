import { CreateBudget } from "@/application/budget/create-budget"
import { factory } from "@/lib/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/interface/shared/to-bounded-int"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { BudgetRepository } from "@/infrastructure/budget/budget-repository"
import { ApplicationError } from "@/lib/errors"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { canViewAllBudgets } from "@/lib/budget/can-view-all-budgets"
import { zAppBudget, zAppBudgetList } from "@/lib/app-schemas"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// GET /budgets — 全社の予算枠（budget:read:all）。消化合計と残額（単純減算）を含む。
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      fiscal_year: z.string().optional(),
      department_code: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (canViewAllBudgets(session) === false) {
      throw new ForbiddenError()
    }

    const query = c.req.valid("query")

    const fiscalYear = toFiscalYear(query.fiscal_year)

    const departmentCode =
      query.department_code !== undefined && query.department_code !== ""
        ? query.department_code
        : null

    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })

    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })

    const repository = new BudgetRepository(c)

    const budgets = await repository.findAll({ fiscalYear, departmentCode, limit, offset })

    if (budgets instanceof Error) {
      throw new InternalError("failed to load budgets")
    }

    const consumedByBudgetId = await repository.sumConsumedByBudgetIds(
      budgets.map((budget) => budget.id ?? 0),
    )

    if (consumedByBudgetId instanceof Error) {
      throw new InternalError("failed to sum budget consumptions")
    }

    const total = await repository.count(fiscalYear, departmentCode)

    if (total instanceof Error) {
      throw new InternalError("failed to count budgets")
    }

    const responseBody = zAppBudgetList.parse({
      data: budgets.map((budget) => {
        const consumed = consumedByBudgetId.get(budget.id ?? 0) ?? 0

        return {
          id: budget.id,
          fiscal_year: budget.fiscalYear,
          department_code: budget.departmentCode,
          title: budget.title,
          amount: budget.amount,
          consumed: consumed,
          remaining: budget.amount - consumed,
          note: budget.note,
          created_at: budget.createdAt,
        }
      }),
      total,
    })

    return c.json(responseBody, 200)
  },
)

// POST /budgets — 予算枠を新規登録（budget:manage）
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      fiscal_year: z.number().int(),
      department_code: z.string().max(200).nullable().optional(),
      title: z.string().min(1).max(300),
      amount: z.number().int().nonnegative(),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const json = c.req.valid("json")

    const created = await new CreateBudget(c).run({
      session,
      budget: {
        fiscalYear: json.fiscal_year,
        departmentCode: json.department_code ?? null,
        title: json.title,
        amount: json.amount,
        note: json.note ?? null,
      },
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppBudget.parse({
      id: created.id,
      fiscal_year: created.fiscalYear,
      department_code: created.departmentCode,
      title: created.title,
      amount: created.amount,
      consumed: 0,
      remaining: created.amount,
      note: created.note,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)

/** fiscal_year クエリを整数へ。空・不正は null（=絞り込みなし）。 */
function toFiscalYear(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") {
    return null
  }

  const parsed = Number(raw)

  return Number.isInteger(parsed) ? parsed : null
}
