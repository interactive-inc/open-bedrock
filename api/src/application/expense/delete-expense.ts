import type { Context } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"

export type Command = {
  expenseId: number
  employeeId: number
}

export type ExpenseNotFound = { reason: "expense_not_found" }

export type NotOwner = { reason: "not_owner" }

export type NotDeletable = { reason: "not_deletable" }

export type Deleted = { reason: "deleted" }

/**
 * 本人の経費申請を取り下げる。本人以外と、承認・却下・精算済みの削除を拒否する。
 */
export class DeleteExpense {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Deleted | ExpenseNotFound | NotOwner | NotDeletable | Error> {
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
      return { reason: "not_deletable" }
    }

    const deleted = await repository.delete(command.expenseId)

    if (deleted instanceof Error) {
      return deleted
    }

    if (deleted === null) {
      return { reason: "not_deletable" }
    }

    return { reason: "deleted" }
  }
}
