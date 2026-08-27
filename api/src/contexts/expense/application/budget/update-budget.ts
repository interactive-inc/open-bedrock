import type { Budget } from "@/contexts/expense/domain/entities/budget.entity"
import type { Context } from "@/env"
import { BudgetRepository } from "@/contexts/expense/infrastructure/repositories/budget/budget.repository"
import { NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  budgetId: number
  amount: number
  name: string
  note: string | null
}

/**
 * 部署予算の金額・名称・メモを変更する。部署・会計期間は変更しない
 */
export class UpdateBudget {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Budget | ApplicationError> {
    const repository = new BudgetRepository(this.c)

    const current = await repository.findById(command.budgetId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find budget", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("budget not found", "budget_not_found")
    }

    const updated = current.withDetails({
      amount: command.amount,
      name: command.name,
      note: command.note,
    })

    const saved = await repository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update budget", { cause: saved })
    }

    if (saved === null) {
      return new NotFoundError("budget not found", "budget_not_found")
    }

    return saved
  }
}
