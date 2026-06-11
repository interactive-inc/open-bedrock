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

    // expense_approvals と expenses を D1 batch でアトミックに削除する。
    // これにより承認処理との TOCTOU 競合で expense_approvals が孤児化するリスクを排除する。
    try {
      const db = this.c.env.DB
      await db.batch([
        db.prepare("DELETE FROM expense_approvals WHERE expense_id = ?1").bind(command.expenseId),
        db.prepare("DELETE FROM expenses WHERE id = ?1").bind(command.expenseId),
      ])
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to delete expense")
    }

    return { reason: "deleted" }
  }
}
