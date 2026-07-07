import type { Budget } from "@/domain/budget/budget.entity"
import { canManageBudgets } from "@/lib/budget/can-manage-budgets"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { BudgetRepository } from "@/infrastructure/budget/budget-repository"

export type Command = {
  session: SessionPayload
  id: number
  details: {
    fiscalYear: number
    departmentCode: string | null
    title: string
    amount: number
    note: string | null
  }
}

/**
 * 権限と存在を確認し、予算枠の属性を更新する。
 */
export class UpdateBudget {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Budget | ApplicationError> {
    const repository = new BudgetRepository(this.c)

    if (canManageBudgets(command.session) === false) {
      return new ForbiddenError("cannot manage budgets", "forbidden")
    }

    const budget = await repository.findById(command.id)

    if (budget instanceof Error) {
      return new UnexpectedError("failed to find budget", { cause: budget })
    }

    if (budget === null) {
      return new NotFoundError("budget not found", "budget_not_found")
    }

    const updated = await repository.update(budget.withDetails(command.details))

    if (updated instanceof Error) {
      return new UnexpectedError("failed to update budget", { cause: updated })
    }

    if (updated === null) {
      return new NotFoundError("budget not found", "budget_not_found")
    }

    return updated
  }
}
