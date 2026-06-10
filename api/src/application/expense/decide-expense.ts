import { canDecideExpense } from "@/domain/expense/can-decide-expense"
import { ExpenseApproval } from "@/domain/expense/expense-approval"
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

export type ExpenseDecision = {
  status: "pending" | "approved" | "rejected" | "settled"
}

export type ExpenseNotFound = { reason: "expense_not_found" }

export type AlreadyDecided = { reason: "already_decided" }

/**
 * 経費のステータスを pending からの条件付き UPDATE で確定し、勝った場合のみ承認/却下を記録する。
 * 並行リクエストは条件付き UPDATE でどちらか 1 件しか確定できず、承認記録も重複しない。
 * 確定後に addApproval が失敗した場合は status のみ確定し承認記録が欠損しうる（D1 に
 * 対話的トランザクションが無いことによる許容済みトレードオフ。Error は呼び出し元へ伝播する）。
 */
export class DecideExpense {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<ExpenseDecision | ExpenseNotFound | AlreadyDecided | { reason: "forbidden" } | Error> {
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
      return { reason: "already_decided" } as const
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const decided = await expenseRepository.decideFromPending({
      expenseId: command.expenseId,
      status: nextStatus,
    })

    if (decided instanceof Error) {
      return decided
    }

    if (decided === null) {
      // 条件付き UPDATE が 0 行更新だった。並行リクエストに先を越されたケースを再読込で分類する。
      const current = await expenseRepository.findById(command.expenseId)

      if (current instanceof Error) {
        return current
      }

      if (current === null) {
        return { reason: "expense_not_found" }
      }

      return { reason: "already_decided" } as const
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

    return { status: decided.status }
  }
}
