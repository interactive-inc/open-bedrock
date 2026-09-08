import type { Context } from "@/env"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { PrepareEmployeeManagementAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-employee-management-authority.adapter"
import type { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { toFiscalYear } from "@/contexts/leave/domain/definitions/fiscal-year.definition"
import { toLeaveDecisionSnapshot } from "@/contexts/leave/domain/definitions/to-leave-decision-snapshot.definition"
import { hasLeaveBalanceTracking } from "@/contexts/leave/domain/policies/has-balance-tracking.policy"
import { ConflictError, ForbiddenError, UnexpectedError, ValidationError } from "@/lib/errors"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

export type PreparedLeaveDecision = Readonly<{
  existing: LeaveRequest
  status: "approved" | "rejected"
  approverId: EmployeeId
  comment: string | null
  fiscalYear: string | null
  assertions: ReadonlyArray<D1PreparedStatement>
  audit: ReadonlyArray<D1PreparedStatement>
}>

/** 人の操作権限と現在の会社資格を確認し、判断と監査を一緒に保存する文を準備する。 */
export class PrepareLeaveDecisionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      session: CompanySessionValue
      tokenVersion: number
      existing: LeaveRequest
      approverId: EmployeeId
      status: "approved" | "rejected"
      comment: string | null
    }>,
  ) {
    if (
      !input.session.hasPermission("leave:approve") ||
      input.session.employeeId !== input.approverId
    )
      return new ForbiddenError("cannot decide leave requests", "forbidden")
    if (input.existing.employeeId === input.approverId)
      return new ForbiddenError("cannot decide own leave request", "self_approval")
    if (input.existing.id === null || input.existing.status !== "pending")
      return new ConflictError("the leave request is already decided", "already_decided")
    if (
      (input.comment !== null && input.comment.length > 3_000) ||
      (input.status === "rejected" && (input.comment === null || input.comment.trim().length === 0))
    )
      return new ValidationError("invalid decision comment", "invalid_comment")

    const now = new Date(this.c.env.NOW ?? Date.now())
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: input.session.accountId,
      tokenVersion: input.tokenVersion,
      permissions: ["leave:approve"],
      now,
    })
    if (human instanceof Error)
      return new UnexpectedError("cannot verify human authorization", { cause: human })
    if (human === "forbidden")
      return new ForbiddenError("current human authorization is required", "forbidden")

    const authority = await new PrepareEmployeeManagementAuthorityAdapter({
      var: this.c.var,
      env: { ...this.c.env, NOW: now.toISOString() },
    }).prepare({
      accountId: input.session.accountId,
      actorEmployeeId: input.approverId,
      subjectEmployeeId: input.existing.employeeId,
    })
    if (authority instanceof Error)
      return new UnexpectedError("cannot resolve current management authority", {
        cause: authority,
      })
    if (authority === null)
      return new ForbiddenError("current management authority is required", "forbidden")

    const fiscalYear = toFiscalYear(input.existing.startDate)
    const endFiscalYear = toFiscalYear(input.existing.endDate)
    if (fiscalYear === null || endFiscalYear === null)
      return new ValidationError("invalid leave request dates", "invalid_start_date")
    if (fiscalYear !== endFiscalYear)
      return new ValidationError("leave request spans multiple fiscal years", "cross_fiscal_year")

    const before = toLeaveDecisionSnapshot(input.existing)
    const audit = SystemAuditEventEntity.create({
      actorAccountId: input.session.accountId,
      action: input.status === "approved" ? "leave.request.approve" : "leave.request.reject",
      targetType: "leave_request",
      targetId: String(input.existing.id),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        principalId: human.principalId,
        permission: "leave:approve",
        employeeId: input.approverId,
        snapshot: authority.snapshot,
        qualification: authority.qualification,
      }),
      beforeJson: JSON.stringify(before),
      afterJson: JSON.stringify({
        ...before,
        status: input.status,
        approverId: input.approverId,
        decidedComment: input.comment,
      }),
      metadataJson: JSON.stringify(this.c.var.auditContext),
      occurredAt: now,
    })
    if (audit instanceof Error)
      return new UnexpectedError("cannot prepare leave decision audit", { cause: audit })

    return {
      existing: input.existing,
      status: input.status,
      approverId: input.approverId,
      comment: input.comment,
      fiscalYear:
        input.status === "approved" && hasLeaveBalanceTracking(input.existing.leaveType)
          ? fiscalYear
          : null,
      assertions: [...human.assertions, authority.guard],
      audit: new SystemAuditEventRepository(this.c).prepareAppend(audit),
    } satisfies PreparedLeaveDecision
  }
}
