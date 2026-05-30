import { ExpenseApproval } from "@/domain/expense/expense-approval"
import type { Expense } from "@/domain/expense/expense"
import type { Context } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"

export type Command = {
  expenseId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

export type ExpenseNotFound = { reason: "expense_not_found" }

/**
 * 承認・却下の記録を残し、経費のステータスを更新する。
 */
export class DecideExpense {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<Expense | ExpenseNotFound | Error> {
    const expenseRepository = new ExpenseRepository(this.c)

    const existing = await expenseRepository.findById(command.expenseId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "expense_not_found" }
    }

    const approval = await expenseRepository.addApproval(
      ExpenseApproval.create({
        expenseId: command.expenseId,
        approverId: command.approverId,
        action: command.action,
        comment: command.comment,
        createdAt: command.createdAt,
      }),
    )

    if (approval instanceof Error) {
      return approval
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const updated = await expenseRepository.update(existing.withStatus(nextStatus))

    if (updated instanceof Error) {
      return updated
    }

    if (updated === null) {
      return { reason: "expense_not_found" }
    }

    return updated
  }
}
