import { BudgetConsumption } from "@/domain/budget/budget-consumption.entity"
import { canManageBudgets } from "@/lib/budget/can-manage-budgets"
import { ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { BudgetRepository } from "@/infrastructure/budget/budget-repository"

export type Command = {
  session: SessionPayload
  budgetId: number
  amount: number
  note: string | null
  recordedOn: string
  createdAt: string
}

/**
 * 権限と親予算枠の存在を確認し、消化記録を手動で追加する。稟議・経費とは自動連動しない。
 */
export class RecordBudgetConsumption {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<BudgetConsumption | ApplicationError> {
    const repository = new BudgetRepository(this.c)

    if (canManageBudgets(command.session) === false) {
      return new ForbiddenError("cannot manage budgets", "forbidden")
    }

    const budget = await repository.findById(command.budgetId)

    if (budget instanceof Error) {
      return new UnexpectedError("failed to find budget", { cause: budget })
    }

    if (budget === null) {
      return new NotFoundError("budget not found", "budget_not_found")
    }

    const consumption = BudgetConsumption.create({
      budgetId: command.budgetId,
      amount: command.amount,
      note: command.note,
      recordedOn: command.recordedOn,
      createdAt: command.createdAt,
    })

    const created = await repository.createConsumption(consumption)

    if (created instanceof Error) {
      return new UnexpectedError("failed to record budget consumption", { cause: created })
    }

    return created
  }
}
