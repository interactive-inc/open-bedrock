import type { Context } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

export type Command = {
  expenseId: number
  employeeId: number
}

export type Deleted = { reason: "deleted" }

/**
 * 本人の経費申請を取り下げる。本人以外と、承認・却下・精算済みの削除を拒否する。
 */
export class DeleteExpense {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Deleted | ApplicationError> {
    const repository = new ExpenseRepository(this.c)

    const current = await repository.findById(command.expenseId)

    if (current instanceof Error) {
      return new UnexpectedError("failed to find expense", { cause: current })
    }

    if (current === null) {
      return new NotFoundError("expense not found", "expense_not_found")
    }

    if (current.employeeId !== command.employeeId) {
      return new ForbiddenError("not the owner of expense", "not_owner")
    }

    if (current.status !== "pending") {
      return new ConflictError("expense is not deletable", "not_deletable")
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
        return new ConflictError("expense is not deletable", "not_deletable")
      }

      return error instanceof Error
        ? new UnexpectedError("failed to delete expense", { cause: error })
        : new UnexpectedError("failed to delete expense")
    }

    return { reason: "deleted" }
  }
}
