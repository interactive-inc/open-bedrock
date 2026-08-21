import { BudgetRepository } from "@/contexts/expense/infrastructure/budget/budget.repository"
import { departments } from "@/contexts/company/infrastructure/schema/organization"
import { factory } from "@/contexts/company/interface/utils/factory"
import { UnexpectedError } from "@/lib/errors"
import { zAppBudgetSummary } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーで判定する
/**
 * GET /department-budgets/summary — 会計期間を指定し、部署ごとの予算・消化額・残額を横断で返す。
 * /budgets/:id と衝突しないよう app.ts では :id より先に登録する。budget:manage を持つロールのみ。
 */
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      fiscal_period: z.string().min(1).max(200),
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

    const query = c.req.valid("query")

    const repository = new BudgetRepository(c)
    const budgets = await repository.list({
      departmentId: null,
      fiscalPeriod: query.fiscal_period,
    })

    if (budgets instanceof Error) {
      throw toHttpException(new UnexpectedError("failed to list budgets", { cause: budgets }))
    }

    const departmentRows = await c.var.database
      .select({ id: departments.id, name: departments.name })
      .from(departments)
    const departmentNames = new Map(departmentRows.map((row) => [row.id, row.name]))
    const budgetAmountByDepartment = new Map<number, number>()
    const consumedByDepartment = new Map<number, number>()

    for (const budget of budgets) {
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

      budgetAmountByDepartment.set(
        budget.departmentId,
        (budgetAmountByDepartment.get(budget.departmentId) ?? 0) + budget.amount,
      )
      consumedByDepartment.set(
        budget.departmentId,
        (consumedByDepartment.get(budget.departmentId) ?? 0) + consumed,
      )
    }

    const rows = [...budgetAmountByDepartment.keys()]
      .toSorted((left, right) => left - right)
      .map((departmentId) => {
        const budgetAmount = budgetAmountByDepartment.get(departmentId) ?? 0
        const consumedAmount = consumedByDepartment.get(departmentId) ?? 0

        return {
          departmentId,
          departmentName: departmentNames.get(departmentId) ?? null,
          fiscalPeriod: query.fiscal_period,
          budgetAmount,
          consumedAmount,
          remainingAmount: budgetAmount - consumedAmount,
        }
      })

    const responseBody = zAppBudgetSummary.parse({
      fiscal_period: query.fiscal_period,
      data: rows.map((row) => ({
        department_id: row.departmentId,
        department_name: row.departmentName,
        fiscal_period: row.fiscalPeriod,
        budget_amount: row.budgetAmount,
        consumed_amount: row.consumedAmount,
        remaining_amount: row.remainingAmount,
      })),
    })

    return c.json(responseBody, 200)
  },
)
