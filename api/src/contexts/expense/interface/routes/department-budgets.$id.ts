import { BudgetRepository } from "@/contexts/expense/infrastructure/budget/budget.repository"
import { departments } from "@/contexts/company/infrastructure/schema/organization"
import { UpdateBudget } from "@/contexts/expense/application/budget/update-budget"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError, NotFoundError, UnexpectedError } from "@/lib/errors"
import { zAppBudget, zAppBudgetDetail } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { eq } from "drizzle-orm"

// @authorization permission - 権限キーで判定する
/** GET /department-budgets/:id — 予算の詳細（承認済み経費の消化額・残額を集計して返す）。budget:manage を持つロールのみ。 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("budget:manage") === false) {
    throw new ForbiddenError()
  }

  const budgetId = validateIntParam(c.req.param("id"), "budget")

  const repository = new BudgetRepository(c)
  const budget = await repository.findById(budgetId)

  if (budget instanceof Error) {
    throw toHttpException(new UnexpectedError("failed to find budget", { cause: budget }))
  }

  if (budget === null || budget.id === null) {
    throw toHttpException(new NotFoundError("budget not found", "budget_not_found"))
  }

  const consumed = await repository.sumApprovedExpenses({
    departmentId: budget.departmentId,
    periodStart: budget.periodStart,
    periodEnd: budget.periodEnd,
  })

  if (consumed instanceof Error) {
    throw toHttpException(
      new UnexpectedError("failed to sum approved expenses", { cause: consumed }),
    )
  }

  const departmentRows = await c.var.database
    .select({ name: departments.name })
    .from(departments)
    .where(eq(departments.id, budget.departmentId))
    .limit(1)

  const responseBody = zAppBudgetDetail.parse({
    id: budget.id,
    department_id: budget.departmentId,
    department_name: departmentRows.at(0)?.name ?? null,
    fiscal_period: budget.fiscalPeriod,
    period_start: budget.periodStart,
    period_end: budget.periodEnd,
    amount: budget.amount,
    name: budget.name,
    note: budget.note,
    consumed_amount: consumed,
    remaining_amount: budget.amount - consumed,
    created_at: budget.createdAt,
  })

  return c.json(responseBody, 200)
})

// @authorization permission - 権限キーで判定する
/** PATCH /department-budgets/:id — 金額・名称・メモを修正する。部署・会計期間は変更しない。budget:manage を持つロールのみ。 */
export const PATCH = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      amount: z.number().positive().int().safe(),
      name: z.string().min(1).max(200),
      note: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    if (session.hasPermission("budget:manage") === false) {
      throw new ForbiddenError()
    }

    const budgetId = validateIntParam(c.req.param("id"), "budget")

    const json = c.req.valid("json")

    const updated = await new UpdateBudget(c).run({
      budgetId,
      amount: json.amount,
      name: json.name,
      note: json.note ?? null,
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppBudget.parse({
      id: updated.id,
      department_id: updated.departmentId,
      fiscal_period: updated.fiscalPeriod,
      period_start: updated.periodStart,
      period_end: updated.periodEnd,
      amount: updated.amount,
      name: updated.name,
      note: updated.note,
      created_at: updated.createdAt,
    })

    return c.json(responseBody, 200)
  },
)

// @authorization permission - 権限キーで判定する
/** DELETE /department-budgets/:id — 予算を削除する。budget:manage を持つロールのみ。 */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  if (session.hasPermission("budget:manage") === false) {
    throw new ForbiddenError()
  }

  const budgetId = validateIntParam(c.req.param("id"), "budget")

  const result = await (async () => {
    const command = { budgetId }

    const repository = new BudgetRepository(c)

    const result = await repository.delete(command.budgetId)

    if (result instanceof Error) {
      return new UnexpectedError("failed to delete budget", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("budget not found", "budget_not_found")
    }

    return { reason: "deleted" }
  })()

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
