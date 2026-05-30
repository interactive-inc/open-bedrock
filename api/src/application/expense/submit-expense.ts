import { Expense } from "@/domain/expense/expense"
import type { Context } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"

export type Command = {
  employeeId: number
  category: "transport" | "supplies" | "entertainment" | "books" | "other"
  amount: number
  spentAt: string
  note: string | null
  createdAt: string
}

/**
 * 本人の経費申請を作成する。
 */
export class SubmitExpense {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Expense | Error> {
    const repository = new ExpenseRepository(this.c)

    const expense = Expense.create({
      employeeId: command.employeeId,
      category: command.category,
      amount: command.amount,
      spentAt: command.spentAt,
      note: command.note,
      createdAt: command.createdAt,
    })

    return await repository.create(expense)
  }
}
