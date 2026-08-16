import type { Context } from "@/env"
import { BudgetRepository } from "@/contexts/expense/infrastructure/budget/budget-repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { departments } from "@/contexts/company/infrastructure/schema/organization"

export type BudgetSummaryRow = {
  departmentId: number
  departmentName: string | null
  fiscalPeriod: string
  budgetAmount: number
  consumedAmount: number
  remainingAmount: number
}

export type BudgetSummaryView = {
  fiscalPeriod: string
  rows: ReadonlyArray<BudgetSummaryRow>
}

export type Command = {
  fiscalPeriod: string
}

/**
 * 指定した会計期間の部署ごとの予算・消化額・残額を横断集計する。
 * 同一部署・期間に複数の予算がある場合は予算額・消化額を合算する
 */
export class BuildBudgetSummaryView {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BudgetSummaryView | ApplicationError> {
    const repository = new BudgetRepository(this.c)

    const budgets = await repository.list({
      departmentId: null,
      fiscalPeriod: command.fiscalPeriod,
    })

    if (budgets instanceof Error) {
      return new UnexpectedError("failed to list budgets", { cause: budgets })
    }

    const departmentRows = await this.c.var.database
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
        return new UnexpectedError("failed to sum approved expenses", { cause: consumed })
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

    const rows: Array<BudgetSummaryRow> = []

    for (const departmentId of budgetAmountByDepartment.keys()) {
      const budgetAmount = budgetAmountByDepartment.get(departmentId) ?? 0

      const consumedAmount = consumedByDepartment.get(departmentId) ?? 0

      rows.push({
        departmentId,
        departmentName: departmentNames.get(departmentId) ?? null,
        fiscalPeriod: command.fiscalPeriod,
        budgetAmount,
        consumedAmount,
        remainingAmount: budgetAmount - consumedAmount,
      })
    }

    rows.sort((left, right) => left.departmentId - right.departmentId)

    return { fiscalPeriod: command.fiscalPeriod, rows }
  }
}
