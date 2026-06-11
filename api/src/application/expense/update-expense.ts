import type { Expense } from "@/domain/expense/expense"
import type { Context } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"

export type Command = {
  expenseId: number
  employeeId: number
  category: "transport" | "supplies" | "entertainment" | "books" | "other"
  amount: number
  spentAt: string
  note: string | null
}

export type ExpenseNotFound = { reason: "expense_not_found" }

export type NotOwner = { reason: "not_owner" }

export type NotEditable = { reason: "not_editable" }

/**
 * 本人の経費申請の内容を変更する。本人以外と、承認・却下・精算済みの変更を拒否する。
 */
export class UpdateExpense {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Expense | ExpenseNotFound | NotOwner | NotEditable | Error> {
    const repository = new ExpenseRepository(this.c)

    const current = await repository.findById(command.expenseId)

    if (current instanceof Error) {
      return current
    }

    if (current === null) {
      return { reason: "expense_not_found" }
    }

    if (current.employeeId !== command.employeeId) {
      return { reason: "not_owner" }
    }

    if (current.status !== "pending") {
      return { reason: "not_editable" }
    }

    const updated = current.withDetails({
      category: command.category,
      amount: command.amount,
      spentAt: command.spentAt,
      note: command.note,
    })

    const saved = await repository.update(updated)

    if (saved instanceof Error) {
      return saved
    }

    if (saved === null) {
      return { reason: "not_editable" }
    }

    return saved
  }
}
