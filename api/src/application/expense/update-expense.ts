import type { Expense } from "@/domain/expense/expense.entity"
import type { Context } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"
import type { ExpenseCategory } from "@/lib/schemas"

export type Command = {
  expenseId: number
  employeeId: number
  category: ExpenseCategory
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
      // update() returned 0 rows — re-read to classify the reason
      const reloaded = await repository.findById(command.expenseId)

      if (reloaded instanceof Error) {
        return reloaded
      }

      if (reloaded === null) {
        return { reason: "expense_not_found" }
      }

      // Row exists but status is no longer pending (concurrent approval/rejection)
      return { reason: "not_editable" }
    }

    return saved
  }
}
