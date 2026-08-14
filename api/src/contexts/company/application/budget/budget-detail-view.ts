import type { Context } from "@/env"
import { BudgetRepository } from "@/contexts/company/infrastructure/budget/budget-repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { departments } from "@/schema"
import { eq } from "drizzle-orm"

export type BudgetDetailView = {
  id: number
  departmentId: number
  departmentName: string | null
  fiscalPeriod: string
  periodStart: string
  periodEnd: string
  amount: number
  name: string
  note: string | null
  consumedAmount: number
  remainingAmount: number
  createdAt: string
}

export type Command = {
  budgetId: number
}

/**
 * 部署予算の詳細を、承認済み経費の消化額・残額とともに組み立てる。消化額は保存せず読み取り集計する
 */
export class BuildBudgetDetailView {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BudgetDetailView | ApplicationError> {
    const repository = new BudgetRepository(this.c)

    const budget = await repository.findById(command.budgetId)

    if (budget instanceof Error) {
      return new UnexpectedError("failed to find budget", { cause: budget })
    }

    if (budget === null || budget.id === null) {
      return new NotFoundError("budget not found", "budget_not_found")
    }

    const consumed = await repository.sumApprovedExpenses({
      departmentId: budget.departmentId,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
    })

    if (consumed instanceof Error) {
      return new UnexpectedError("failed to sum approved expenses", { cause: consumed })
    }

    const departmentRows = await this.c.var.database
      .select({ name: departments.name })
      .from(departments)
      .where(eq(departments.id, budget.departmentId))
      .limit(1)

    return {
      id: budget.id,
      departmentId: budget.departmentId,
      departmentName: departmentRows.at(0)?.name ?? null,
      fiscalPeriod: budget.fiscalPeriod,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
      amount: budget.amount,
      name: budget.name,
      note: budget.note,
      consumedAmount: consumed,
      remainingAmount: budget.amount - consumed,
      createdAt: budget.createdAt,
    }
  }
}
