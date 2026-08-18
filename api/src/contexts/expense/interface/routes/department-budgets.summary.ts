import { BuildBudgetSummaryView } from "@/contexts/expense/application/budget/budget-summary-view"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppBudgetSummary } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company-compatibility/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/contexts/company-compatibility/interface/lib/errors"
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

    const view = await new BuildBudgetSummaryView(c).run({
      fiscalPeriod: query.fiscal_period,
    })

    if (view instanceof ApplicationError) {
      throw toHttpException(view)
    }

    const responseBody = zAppBudgetSummary.parse({
      fiscal_period: view.fiscalPeriod,
      data: view.rows.map((row) => ({
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
