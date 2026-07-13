import { canDecideExpense } from "@/lib/expense/can-decide-expense"
import { NotifyApprovalResult } from "@/application/notification/notify-approval-result"
import { ExpenseApproval } from "@/domain/expense/expense-approval.entity"
import type { Context, SessionPayload } from "@/env"
import { ExpenseRepository } from "@/infrastructure/expense/expense-repository"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"
import { hasPermission } from "@/lib/auth/has-permission"
import { resolveOrganizationAuthority } from "@/lib/org/organization-authority"

export type Command = {
  session: SessionPayload
  expenseId: number
  approverId: number
  action: "approve" | "reject"
  comment: string | null
  createdAt: string
}

export type ExpenseDecision = {
  status: "pending" | "approved" | "rejected" | "settled"
}

/**
 * 経費のステータスを pending からの条件付き UPDATE で確定し、承認記録を同時に INSERT する。
 * D1 batch で status UPDATE と approval INSERT をアトミックに行うため、
 * status だけ確定し承認記録が欠損する不整合は起きない。
 * 並行リクエストは条件付き UPDATE でどちらか 1 件しか確定できず、承認記録も重複しない。
 */
export class DecideExpense {
  constructor(private readonly c: Context) {}

  async run(command: Command): Promise<ExpenseDecision | ApplicationError> {
    if (canDecideExpense(command.session) === false) {
      return new ForbiddenError("cannot decide expense", "forbidden")
    }

    const expenseRepository = new ExpenseRepository(this.c)

    const existing = await expenseRepository.findById(command.expenseId)

    if (existing instanceof Error) {
      return new UnexpectedError("failed to find expense", { cause: existing })
    }

    if (existing === null) {
      return new NotFoundError("expense not found", "expense_not_found")
    }

    if (existing.employeeId === command.approverId) {
      return new ForbiddenError("cannot decide own expense", "forbidden")
    }

    const organizationAuthority = await resolveOrganizationAuthority(
      this.c,
      command.approverId,
      existing.employeeId,
    )

    if (organizationAuthority instanceof Error) {
      return new UnexpectedError("failed to resolve organization authority", {
        cause: organizationAuthority,
      })
    }

    const isInScope =
      organizationAuthority.managementChain ||
      organizationAuthority.departmentManager ||
      hasPermission(command.session, "org:manage")

    if (isInScope === false) {
      return new ForbiddenError("cannot decide expense outside organization scope", "forbidden")
    }

    if (existing.status !== "pending") {
      return new ConflictError("expense already decided", "already_decided")
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
      return new UnexpectedError("failed to decide expense", { cause: decided })
    }

    if (decided === null) {
      // 条件付き UPDATE が 0 行更新だった。並行リクエストに先を越されたケースを再読込で分類する。
      const current = await expenseRepository.findById(command.expenseId)

      if (current instanceof Error) {
        return new UnexpectedError("failed to find expense", { cause: current })
      }

      if (current === null) {
        return new NotFoundError("expense not found", "expense_not_found")
      }

      return new ConflictError("expense already decided", "already_decided")
    }

    // 決定は確定済みのため、申請者への結果通知が失敗しても決定は返す。
    await new NotifyApprovalResult(this.c).run({
      recipientEmployeeId: existing.employeeId,
      action: command.action,
      subjectLabel: "経費申請",
      sourceDomain: "expense",
      sourceId: command.expenseId,
      createdAt: command.createdAt,
    })

    return { status: decided.status }
  }
}
