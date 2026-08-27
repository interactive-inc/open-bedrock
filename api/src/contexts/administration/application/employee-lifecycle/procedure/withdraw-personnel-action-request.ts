import { createAdministrationAuditEvent } from "@/contexts/administration/domain/factories/administration-audit-event.factory"
import { findPersonnelActionRequest } from "@/contexts/company/infrastructure/employee-lifecycle/find-personnel-action-request.repository"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import type { Session } from "@/lib/auth/session"
import { WithdrawPersonnelActionRequestAdapter } from "@/contexts/administration/infrastructure/adapters/employee-lifecycle/withdraw-personnel-action-request.adapter"
import type { Context } from "@/env"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"

export class WithdrawPersonnelActionRequest {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: {
    session: Session
    requestId: string
    withdrawnAt: string
  }): Promise<{ status: "withdrawn" } | ApplicationError> {
    const request = await findPersonnelActionRequest(this.c, command.session, {
      id: command.requestId,
    })
    if (request instanceof CompanyOperationError) {
      return new UnexpectedError("人事変更申請を取得できません", {
        cause: request,
      })
    }
    if (request === null) {
      return new NotFoundError("人事変更申請が見つかりません", "personnel_action_request_not_found")
    }
    if (request.requestedByEmployeeId !== command.session.employeeId) {
      return new ForbiddenError("申請者だけが人事変更申請を取り下げられます", "forbidden")
    }
    if (request.status !== "pending") {
      return new ConflictError("この人事変更申請は取り下げられません", "already_decided")
    }
    const withdrawnAt = new Date(command.withdrawnAt)
    const milliseconds = withdrawnAt.getTime()
    if (!Number.isFinite(milliseconds)) {
      return new ConflictError("取り下げ日時が不正です", "already_decided")
    }
    const audit = createAdministrationAuditEvent(
      {
        actorAccountId: command.session.accountId,
        actorEmployeeId: command.session.employeeId,
        action: "employee.lifecycle.request_withdrawn",
        target: {
          type: "employee",
          id: request.targetEmployeeId === null ? null : String(request.targetEmployeeId),
        },
        outcome: "succeeded",
        reasonCode: null,
        authorization: {
          workflowTask: true,
          applicationId: request.applicationId,
        },
        metadata: { actionKind: request.kind },
        now: withdrawnAt,
      },
      this.c.var.auditContext,
    )
    const withdrawn = await new WithdrawPersonnelActionRequestAdapter(this.c).withdraw({
      requestId: command.requestId,
      applicationId: request.applicationId,
      employeeId: command.session.employeeId,
      accountId: command.session.accountId,
      withdrawnAt,
      audit,
    })
    if (withdrawn === "conflict") {
      return new ConflictError("この人事変更申請はすでに処理されています", "already_decided")
    }
    return withdrawn instanceof Error
      ? new UnexpectedError("人事変更申請を取り下げられません", { cause: withdrawn })
      : { status: "withdrawn" }
  }
}
