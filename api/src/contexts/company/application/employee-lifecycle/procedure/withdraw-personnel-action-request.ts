import { createAuditEvent } from "@/contexts/company/domain/audit/company-audit-event"
import { findPersonnelActionRequest } from "@/contexts/company/infrastructure/employee-lifecycle/find-personnel-action-request.repository"
import type { Session } from "@/contexts/company/domain/iam/session"
import { AuditEventRepository } from "@/contexts/company/infrastructure/audit/audit-event.repository"
import type { Context } from "@/env"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { prepareSystemProcedureCancellation } from "@system/infrastructure/workflow/prepare-system-procedure-cancellation.repository"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"

export class WithdrawPersonnelActionRequest {
  constructor(private readonly c: Context) {}

  async run(command: {
    session: Session
    requestId: string
    withdrawnAt: string
  }): Promise<{ status: "withdrawn" } | ApplicationError> {
    const request = await findPersonnelActionRequest(this.c, command.session, {
      id: command.requestId,
    })
    if (request instanceof ApplicationError) return request
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
    const seconds = Math.floor(milliseconds / 1_000)
    if (!Number.isFinite(seconds)) {
      return new ConflictError("取り下げ日時が不正です", "already_decided")
    }
    const audit = createAuditEvent(
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
        authorization: { workflowTask: true, applicationId: request.applicationId },
        metadata: { actionKind: request.kind },
        now: withdrawnAt,
      },
      this.c.var.auditContext,
    )
    const cancellationStatements = prepareSystemProcedureCancellation(
      { env: { DB: this.c.env.DB } },
      {
        number: request.applicationId,
        createdByAccountId: command.session.accountId,
        cancelledAt: withdrawnAt,
      },
    )
    if (cancellationStatements instanceof Error) {
      return new UnexpectedError("人事変更申請を取り下げられません", {
        cause: cancellationStatements,
      })
    }
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE personnel_action_requests
             SET withdrawn_at = ?2, withdrawn_by_employee_id = ?3
             WHERE id = ?1 AND withdrawn_at IS NULL AND applied_action_id IS NULL
               AND requested_by_employee_id = ?3
             RETURNING id`,
        ).bind(command.requestId, seconds, command.session.employeeId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...cancellationStatements,
        ...new AuditEventRepository(this.c).prepareAppend(audit),
      ])
      return { status: "withdrawn" }
    } catch (cause) {
      return isAbortedByGuard(cause)
        ? new ConflictError("この人事変更申請はすでに処理されています", "already_decided")
        : new UnexpectedError("人事変更申請を取り下げられません", { cause })
    }
  }
}
