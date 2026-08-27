import { Expense } from "@/contexts/expense/domain/entities/expense.entity"
import type { Context } from "@/env"
import { ExpenseRepository } from "@/contexts/expense/infrastructure/repositories/expense.repository"
import { UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ExpenseCategory } from "@/lib/schemas"

export type Command = {
  employeeId: number
  category: ExpenseCategory
  amount: number
  spentAt: string
  note: string | null
  createdAt: string
}

/**
 * 本人の経費申請を作成する。
 */
export class SubmitExpense {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Expense | ApplicationError> {
    const repository = new ExpenseRepository(this.c)

    const expense = Expense.create({
      employeeId: command.employeeId,
      category: command.category,
      amount: command.amount,
      spentAt: command.spentAt,
      note: command.note,
      createdAt: command.createdAt,
    })

    const created = await repository.create(expense)

    if (created instanceof Error) {
      return new UnexpectedError("failed to create expense", { cause: created })
    }

    return created
  }
}
