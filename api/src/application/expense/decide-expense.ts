import { canDecideExpense } from "@/lib/expense/can-decide-expense"
import { ExpenseApproval } from "@/domain/expense/expense-approval.entity"
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

export type Forbidden = { reason: "forbidden" }

/**
 * 経費のステータスを pending からの条件付き UPDATE で確定し、承認記録を同時に INSERT する。
 * D1 batch で status UPDATE と approval INSERT をアトミックに行うため、
 * status だけ確定し承認記録が欠損する不整合は起きない。
 * 並行リクエストは条件付き UPDATE でどちらか 1 件しか確定できず、承認記録も重複しない。
 */
export class DecideExpense {
  constructor(private readonly c: Context) {}

  async run(
    command: Command,
  ): Promise<ExpenseDecision | ExpenseNotFound | AlreadyDecided | Forbidden | Error> {
    if (canDecideExpense(command.viewerRole) === false) {
      return { reason: "forbidden" }
    }

    const expenseRepository = new ExpenseRepository(this.c)

    const existing = await expenseRepository.findById(command.expenseId)

    if (existing instanceof Error) {
      return existing
    }

    if (existing === null) {
      return { reason: "expense_not_found" }
    }

    if (existing.employeeId === command.approverId) {
      return { reason: "forbidden" }
    }

    if (existing.status !== "pending") {
      return { reason: "already_decided" }
    }

    const nextStatus = command.action === "approve" ? "approved" : "rejected"

    const approval = ExpenseApproval.create({
      expenseId: command.expenseId,
      approverId: command.approverId,
      action: command.action,
      comment: command.comment,
      createdAt: command.createdAt,
    })

    const decided = await expenseRepository.decideFromPendingWithApproval({
      expenseId: command.expenseId,
      status: nextStatus,
      approval,
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

      return { reason: "already_decided" }
    }

    return { status: decided.status }
  }
}
