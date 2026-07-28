import { BuildBudgetDetailView } from "@/application/budget/budget-detail-view"
import { DeleteBudget } from "@/application/budget/delete-budget"
import { UpdateBudget } from "@/application/budget/update-budget"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppBudget, zAppBudgetDetail } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

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

  const view = await new BuildBudgetDetailView(c).run({ budgetId })

  if (view instanceof ApplicationError) {
    throw toHttpException(view)
  }

  const responseBody = zAppBudgetDetail.parse({
    id: view.id,
    department_id: view.departmentId,
    department_name: view.departmentName,
    fiscal_period: view.fiscalPeriod,
    period_start: view.periodStart,
    period_end: view.periodEnd,
    amount: view.amount,
    name: view.name,
    note: view.note,
    consumed_amount: view.consumedAmount,
    remaining_amount: view.remainingAmount,
    created_at: view.createdAt,
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

  const result = await new DeleteBudget(c).run({ budgetId })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
