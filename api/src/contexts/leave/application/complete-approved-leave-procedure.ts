import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { toFiscalYear } from "@/contexts/leave/domain/definitions/fiscal-year.definition"
import { hasLeaveBalanceTracking } from "@/contexts/leave/domain/policies/has-balance-tracking.policy"
import { LeaveDecisionNotificationValue } from "@/contexts/leave/domain/values/leave-decision-notification.value"
import { PrepareLeaveDecisionNotificationAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-decision-notification.adapter"
import type { Context } from "@/env"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"
import { LeaveProcedureRepository } from "@/contexts/leave/infrastructure/repositories/leave-procedure.repository"
import type { LeaveProcedureBinding } from "@/contexts/leave/domain/definitions/leave-procedure.definition"
import type { LeaveRequest } from "@/contexts/leave/domain/entities/leave-request.entity"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  type ApplicationError,
} from "@/lib/errors"

type Command = Readonly<{
  leaveRequestId: number
  session: CompanyPersonnelSession
  tokenVersion: number
  completedAt: Date
}>

/** 全段階の現在の承認資格を確認し、休暇の決裁結果を一度だけ確定する。 */
export class CompleteApprovedLeaveProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: Command,
  ): Promise<Readonly<{ status: "approved"; replayed: boolean }> | ApplicationError> {
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["leave:approve"],
      now: command.completedAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("休暇を確定する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("休暇の実行権限を確認できません", { cause: human })
    const repository = new LeaveProcedureRepository(this.c)
    const request = await new LeaveRequestRepository(this.c).findById(command.leaveRequestId)
    if (request instanceof Error)
      return new UnexpectedError("休暇を取得できません", { cause: request })
    if (request === null) return new NotFoundError("休暇が見つかりません", "leave_not_found")
    const binding = await repository.findForRequest(command.leaveRequestId)
    if (binding instanceof Error)
      return new UnexpectedError("休暇の承認案件を取得できません", { cause: binding })
    if (binding === null)
      return new ConflictError("休暇を承認案件へ接続する必要があります", "procedure_required")
    if (request.status === "approved")
      return this.replay({
        request,
        binding,
        verifyReceipt: () =>
          repository.readExecutionReceipt({
            binding,
            actorAccountId: command.session.accountId,
            guards: human.assertions,
          }),
      })
    if (request.status !== "pending")
      return new ConflictError("休暇は確定できません", "already_decided")
    const guards = await new RevalidateCompanyProcedureExecutionAdapter(this.c).prepare({
      applicationId: binding.applicationId,
      expectedCaseId: binding.caseId,
      expectedSeriesId: binding.seriesId,
      expectedProposalDigest: binding.proposalDigest,
      expectedPayload: request.toProposalBody(),
      completionOperationKey: "leave.request.authorize",
      subjectEmployeeId: request.employeeId,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set([request.employeeId]),
      executorAccountId: command.session.accountId,
      executorEmployeeId: command.session.employeeId,
      executedAt: command.completedAt,
    })
    if (guards instanceof CompanyOperationError)
      return new ForbiddenError("休暇の現在の承認資格を確認できません", "forbidden", {
        cause: guards,
      })
    const authorization = ExecutionAuthorizationEntity.create({
      id: crypto.randomUUID(),
      caseId: binding.caseId,
      operationKey: "leave.request.authorize",
      proposalDigest: binding.proposalDigest,
      grantedToAccountId: command.session.accountId,
      grantedAt: command.completedAt,
      expiresAt: new Date(command.completedAt.getTime() + 300_000),
      usedAt: null,
    })
    if (authorization instanceof Error)
      return new UnexpectedError("休暇の実行許可を作成できません", { cause: authorization })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "leave.request.authorized",
      targetType: "leave.request",
      targetId: String(command.leaveRequestId),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permission: "leave:approve",
        caseId: binding.caseId,
        proposalDigest: binding.proposalDigest,
      }),
      beforeJson: JSON.stringify({ status: "pending" }),
      afterJson: JSON.stringify({ status: "approved" }),
      metadataJson: JSON.stringify({
        ...this.c.var.auditContext,
        actorEmployeeId: command.session.employeeId,
      }),
      occurredAt: command.completedAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("休暇の実行監査を作成できません", { cause: audit })
    const fiscalYear = toFiscalYear(request.startDate)
    if (fiscalYear === null || fiscalYear !== toFiscalYear(request.endDate))
      return new ConflictError("休暇の年度を確認できません", "invalid_fiscal_year")
    const notification = LeaveDecisionNotificationValue.create({
      decisionAuditId: audit.eventId,
      leaveRequestId: command.leaveRequestId,
      recipientEmployeeId: request.employeeId,
      outcome: "approved",
      decidedAt: command.completedAt.getTime(),
    })
    if (notification instanceof Error)
      return new UnexpectedError("通知を準備できません", { cause: notification })
    const queued = await new PrepareLeaveDecisionNotificationAdapter(this.c).prepare(
      notification,
      command.session.accountId,
    )
    if (queued instanceof Error)
      return new UnexpectedError("通知を予約できません", { cause: queued })
    const executed = await repository.executeAuthorized({
      binding,
      authorization,
      guards: [...human.assertions, ...guards],
      audit,
      approverId: command.session.employeeId,
      request,
      fiscalYear: hasLeaveBalanceTracking(request.leaveType) ? fiscalYear : null,
      notification: queued,
    })
    if (executed === true) return { status: "approved", replayed: false }
    const current = await new LeaveRequestRepository(this.c).findById(command.leaveRequestId)
    if (!(current instanceof Error) && current?.status === "approved")
      return this.replay({
        request: current,
        binding,
        verifyReceipt: () =>
          repository.readExecutionReceipt({
            binding,
            actorAccountId: command.session.accountId,
            guards: human.assertions,
          }),
      })
    return new ConflictError("保存までに休暇の実行条件が変わりました", "execution_changed", {
      cause: executed,
    })
  }

  private async replay(
    input: Readonly<{
      request: LeaveRequest
      binding: LeaveProcedureBinding
      verifyReceipt: () => Promise<boolean | Error>
    }>,
  ): Promise<Readonly<{ status: "approved"; replayed: true }> | ApplicationError> {
    const request = input.request
    const binding = input.binding
    const proposal = await new SystemD1ProposalAdapter(this.c).findByNumber(binding.applicationId)
    const payload = CanonicalSystemJsonValue.create(request.toProposalBody())
    if (
      proposal instanceof Error ||
      payload instanceof Error ||
      proposal === null ||
      proposal.status !== "executed" ||
      proposal.caseId !== binding.caseId ||
      proposal.seriesId !== binding.seriesId ||
      proposal.digest !== binding.proposalDigest ||
      proposal.bodyJson !== payload.toString() ||
      proposal.completionOperationKey !== "leave.request.authorize"
    )
      return new ConflictError("確定済みの休暇内容を確認できません", "execution_changed")
    const receipt = await input.verifyReceipt()
    if (receipt instanceof Error)
      return new ForbiddenError("確定結果を取得する権限が変わりました", "forbidden", {
        cause: receipt,
      })
    if (!receipt) return new ConflictError("別の実行者が休暇を確定しています", "already_decided")
    return { status: "approved", replayed: true }
  }
}
