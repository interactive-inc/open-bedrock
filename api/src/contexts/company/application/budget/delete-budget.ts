import type { Context } from "@/env"
import { BudgetRepository } from "@/infrastructure/budget/budget-repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  budgetId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 部署予算を削除する。消化額はスナップショットしないため、削除で経費側には影響しない
 */
export class DeleteBudget {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const repository = new BudgetRepository(this.c)

    const result = await repository.delete(command.budgetId)

    if (result instanceof Error) {
      return new UnexpectedError("failed to delete budget", { cause: result })
    }

    if (result === null) {
      return new NotFoundError("budget not found", "budget_not_found")
    }

    return { reason: "deleted" }
  }
}
