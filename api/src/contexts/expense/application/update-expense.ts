import type { Expense } from "@/contexts/expense/domain/entities/expense.entity"
import type { Context } from "@/env"
import { ExpenseRepository } from "@/contexts/expense/infrastructure/expense.repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import type { ExpenseCategory } from "@/lib/schemas"

export type Command = {
  expenseId: number
  employeeId: number
  category: ExpenseCategory
  amount: number
  spentAt: string
  note: string | null
}

/**
 * 本人の経費申請の内容を変更する。本人以外と、承認・却下・精算済みの変更を拒否する。
 */
export class UpdateExpense {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Expense | ApplicationError> {
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
      return new ConflictError("expense is not editable", "not_editable")
    }

    const updated = current.withDetails({
      category: command.category,
      amount: command.amount,
      spentAt: command.spentAt,
      note: command.note,
    })

    const saved = await repository.update(updated)

    if (saved instanceof Error) {
      return new UnexpectedError("failed to update expense", { cause: saved })
    }

    if (saved === null) {
      // update() returned 0 rows — re-read to classify the reason
      const reloaded = await repository.findById(command.expenseId)

      if (reloaded instanceof Error) {
        return new UnexpectedError("failed to find expense", { cause: reloaded })
      }

      if (reloaded === null) {
        return new NotFoundError("expense not found", "expense_not_found")
      }

      // Row exists but status is no longer pending (concurrent approval/rejection)
      return new ConflictError("expense is not editable", "not_editable")
    }

    return saved
  }
}
