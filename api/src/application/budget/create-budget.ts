import { Budget } from "@/domain/budget/budget.entity"
import { canManageBudgets } from "@/lib/budget/can-manage-budgets"
import { ForbiddenError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { Context, SessionPayload } from "@/env"
import { BudgetRepository } from "@/infrastructure/budget/budget-repository"

export type Command = {
  session: SessionPayload
  budget: {
    fiscalYear: number
    departmentCode: string | null
    title: string
    amount: number
    note: string | null
  }
  createdAt: string
}

/**
 * 権限を確認し、予算枠を新規登録する。
 */
export class CreateBudget {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Budget | ApplicationError> {
    if (canManageBudgets(command.session) === false) {
      return new ForbiddenError("cannot manage budgets", "forbidden")
    }

    const budget = Budget.create({
      fiscalYear: command.budget.fiscalYear,
      departmentCode: command.budget.departmentCode,
      title: command.budget.title,
      amount: command.budget.amount,
      note: command.budget.note,
      createdAt: command.createdAt,
    })

    const created = await new BudgetRepository(this.c).create(budget)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create budget", { cause: created })
    }

    return created
  }
}
