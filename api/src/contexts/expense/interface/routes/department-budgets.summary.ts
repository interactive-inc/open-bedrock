import { BudgetRepository } from "@/contexts/expense/infrastructure/repositories/budget/budget.repository"
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { factory } from "@/api/http/factory"
import { UnexpectedError } from "@/lib/errors"
import { zAppBudgetSummary } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ForbiddenError, UnauthorizedError } from "@/lib/http/errors"
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
      organizationUnitId: null,
      fiscalPeriod: query.fiscal_period,
    })

    if (budgets instanceof Error) {
      throw toHttpException(new UnexpectedError("failed to list budgets", { cause: budgets }))
    }

    const snapshot = await new ReadCanonicalOrganizationStateAdapter(
      c,
    ).readCanonicalOrganizationState()
    if (snapshot instanceof Error) {
      throw toHttpException(
        new UnexpectedError("failed to load organization units", { cause: snapshot }),
      )
    }
    const unitNames = new Map(
      snapshot.organization.units.map((unit) => [unit.organizationUnitId, unit.officialName]),
    )
    const budgetAmountByUnit = new Map<OrganizationUnitId, number>()
    const consumedByUnit = new Map<OrganizationUnitId, number>()

    for (const budget of budgets) {
      const consumed = await repository.sumApprovedExpenses({
        organizationUnitId: budget.organizationUnitId,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
      })

      if (consumed instanceof Error) {
        throw toHttpException(
          new UnexpectedError("failed to sum approved expenses", { cause: consumed }),
        )
      }

      budgetAmountByUnit.set(
        budget.organizationUnitId,
        (budgetAmountByUnit.get(budget.organizationUnitId) ?? 0) + budget.amount,
      )
      consumedByUnit.set(
        budget.organizationUnitId,
        (consumedByUnit.get(budget.organizationUnitId) ?? 0) + consumed,
      )
    }

    const rows = [...budgetAmountByUnit.keys()].toSorted().map((organizationUnitId) => {
      const budgetAmount = budgetAmountByUnit.get(organizationUnitId) ?? 0
      const consumedAmount = consumedByUnit.get(organizationUnitId) ?? 0

      return {
        organizationUnitId,
        organizationUnitName: unitNames.get(organizationUnitId) ?? null,
        fiscalPeriod: query.fiscal_period,
        budgetAmount,
        consumedAmount,
        remainingAmount: budgetAmount - consumedAmount,
      }
    })

    const responseBody = zAppBudgetSummary.parse({
      fiscal_period: query.fiscal_period,
      data: rows.map((row) => ({
        organization_unit_id: row.organizationUnitId,
        organization_unit_name: row.organizationUnitName,
        fiscal_period: row.fiscalPeriod,
        budget_amount: row.budgetAmount,
        consumed_amount: row.consumedAmount,
        remaining_amount: row.remainingAmount,
      })),
    })

    return c.json(responseBody, 200)
  },
)
