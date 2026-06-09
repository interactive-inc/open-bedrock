import { canDecideExpense } from "@/domain/expense/can-decide-expense"
import { ExpenseApproval } from "@/domain/expense/expense-approval"
import type { Expense } from "@/domain/expense/expense"
import type { Context } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"

export type Command = {
  viewerRole: string
  expenseId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

export type ExpenseNotFound = { reason: "expense_not_found" }

export type AlreadyDecided = { reason: "already_decided" }

/**
 * 承認・却下の記録を残し、経費のステータスを更新する。
 */
export class DecideExpense {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<Expense | ExpenseNotFound | AlreadyDecided | { reason: "forbidden" } | Error> {
    if (canDecideExpense(command.viewerRole) === false) {
      return { reason: "forbidden" } as const
    }

    const expenseRepository = new ExpenseRepository(this.c)

    const existing = await expenseRepository.findById(command.expenseId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "expense_not_found" }
    }

    if (existing.status !== "pending") {
      return { reason: "already_decided" }
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
