import type { Session } from "@/lib/auth/session"
import { createAuditEvent } from "@/domain/audit/audit-event"
import type { Context } from "@/env"
import { AuditEventRepository } from "@/infrastructure/audit/audit-event-repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/d1/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/d1/is-aborted-by-guard"
import {
  ApplicationError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
} from "@/lib/errors"
import { PersonnelActionRequestAccess } from "@/application/employee-lifecycle/personnel-action-request-access"

export class WithdrawPersonnelActionRequest {
  constructor(private readonly c: Context) {}

  async run(command: {
    session: Session
    requestId: string
    withdrawnAt: string
  }): Promise<{ status: "withdrawn" } | ApplicationError> {
    const request = await new PersonnelActionRequestAccess({
      c: this.c,
      session: command.session,
    }).find(command.requestId)
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
    const seconds = Math.floor(Date.parse(command.withdrawnAt) / 1_000)
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
        now: new Date(command.withdrawnAt),
      },
      this.c.var.auditContext,
    )
    try {
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE personnel_action_requests
             SET withdrawn_at = ?2, withdrawn_by_employee_id = ?3
             WHERE id = ?1 AND withdrawn_at IS NULL AND applied_action_id IS NULL
               AND EXISTS (
                 SELECT 1 FROM applications
                 WHERE id = personnel_action_requests.application_id
                   AND status = 'pending' AND applicant_id = ?3
               )
             RETURNING id`,
        ).bind(command.requestId, seconds, command.session.employeeId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        this.c.env.DB.prepare(
          `UPDATE applications SET status = 'rejected', current_step = NULL
             WHERE id = ?1 AND status = 'pending' RETURNING id`,
        ).bind(request.applicationId),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
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
