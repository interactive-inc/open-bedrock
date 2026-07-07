import { UpdateBudget } from "@/application/budget/update-budget"
import type { Budget } from "@/domain/budget/budget.entity"
import type { Context } from "@/env"
import { factory } from "@/lib/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppBudget } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { BudgetRepository } from "@/infrastructure/budget/budget-repository"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// PUT /budgets/:id — 予算枠の属性を更新（budget:manage）。消化合計を計算し残額付きで返す。
export const PUT = factory.createHandlers(
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

    const budgetId = validateIntParam(c.req.param("id"), "budget")

    const updated = await new UpdateBudget(c).run({
      session,
      id: budgetId,
      details: {
        fiscalYear: json.fiscal_year,
        departmentCode: json.department_code ?? null,
        title: json.title,
        amount: json.amount,
        note: json.note ?? null,
      },
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = await toResponseBody(c, updated)

    if (responseBody instanceof Error) {
      throw new InternalError("failed to sum budget consumptions")
    }

    return c.json(responseBody, 200)
  },
)

// 消化合計を引いて残額付きのレスポンスに整える。
async function toResponseBody(c: Context, budget: Budget) {
  const consumedByBudgetId = await new BudgetRepository(c).sumConsumedByBudgetIds([budget.id ?? 0])

  if (consumedByBudgetId instanceof Error) {
    return consumedByBudgetId
  }

  const consumed = consumedByBudgetId.get(budget.id ?? 0) ?? 0

  return zAppBudget.parse({
    id: budget.id,
    fiscal_year: budget.fiscalYear,
    department_code: budget.departmentCode,
    title: budget.title,
    amount: budget.amount,
    consumed: consumed,
    remaining: budget.amount - consumed,
    note: budget.note,
    created_at: budget.createdAt,
  })
}
