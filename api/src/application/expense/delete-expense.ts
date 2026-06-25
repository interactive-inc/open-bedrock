import type { Context } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"
import { UnexpectedError } from "@/lib/errors"

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
    // expenses を status='pending' 付きで先に削除し、承認処理との TOCTOU 競合を防ぐ。
    // 0 行削除（承認済みへ遷移済み）は abortWhenPreviousStatementChangedNoRows で
    // 後続の expense_approvals 削除ごとロールバックし、孤児化を排除する。
    try {
      const db = this.c.env.DB
      await db.batch([
        db
          .prepare("DELETE FROM expenses WHERE id = ?1 AND status = 'pending'")
          .bind(command.expenseId),
        abortWhenPreviousStatementChangedNoRows(db),
        db.prepare("DELETE FROM expense_approvals WHERE expense_id = ?1").bind(command.expenseId),
      ])
    } catch (error) {
      if (isAbortedByGuard(error)) {
        return { reason: "not_deletable" }
      }
      return error instanceof Error
        ? new UnexpectedError("failed to delete expense", { cause: error })
        : new UnexpectedError("failed to delete expense")
    }

    return { reason: "deleted" }
  }
}

function abortWhenPreviousStatementChangedNoRows(db: D1Database): D1PreparedStatement {
  return db.prepare("SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END AS ok")
}

function isAbortedByGuard(error: unknown): boolean {
  return error instanceof Error && error.message.includes("malformed JSON")
}
