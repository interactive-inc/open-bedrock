import { PrepareLeaveHumanEmployeeAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-human-employee.adapter"
import type { Context } from "@/env"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { LeaveProcedureRepository } from "@/contexts/leave/infrastructure/repositories/leave-procedure.repository"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemDecisionTargetValue } from "@system/domain/values/workflow/system-decision-target.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { ConflictError, ForbiddenError, UnexpectedError, type ApplicationError } from "@/lib/errors"

type Command = Readonly<{
  leaveRequestId: number
  session: CompanyPersonnelSession
  tokenVersion: number
  decisionTarget: Readonly<{
    proposalVersion: number
    proposalDigest: string
    taskKey: string
    taskRound: number
  }>
  cancelledAt: Date
}>

/** 本人が確認した承認待ちの休暇を取り消し、判断と取消の同時確定を防ぐ。 */
export class CancelLeaveProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async run(
    command: Command,
  ): Promise<Readonly<{ status: "cancelled"; replayed: boolean }> | ApplicationError> {
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["leave:submit"],
      now: command.cancelledAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("休暇を取り消す権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("取消権限を確認できません", { cause: human })
    const repository = new LeaveProcedureRepository(this.c)
    const qualified = await new PrepareLeaveHumanEmployeeAdapter(this.c).prepare({
      accountId: command.session.accountId,
      employeeId: command.session.employeeId,
      now: command.cancelledAt,
    })
    if (qualified instanceof Error) return qualified
    const companyGuard = qualified.guard
    const binding = await repository.findForRequest(command.leaveRequestId)
    if (binding instanceof Error)
      return new UnexpectedError("休暇の案件を取得できません", { cause: binding })
    if (binding === null)
      return new ConflictError("休暇を承認規程へ提出してください", "procedure_required")
    const proposal = await new SystemD1ProposalAdapter(this.c).findByNumber(binding.applicationId)
    if (proposal instanceof Error || proposal === null)
      return new UnexpectedError("休暇の提案を取得できません")
    const owned = await repository.readSubmissionReceipt({
      binding,
      actorAccountId: command.session.accountId,
      guards: [...human.assertions, companyGuard],
    })
    if (owned !== true) return new ForbiddenError("本人の休暇だけを取り消せます", "forbidden")
    const expected = SystemDecisionTargetValue.create(command.decisionTarget)
    const target = SystemDecisionTargetValue.create({
      proposalVersion: proposal.version,
      proposalDigest: proposal.digest,
      taskKey: proposal.currentTaskKey ?? proposal.lastTaskKey,
      taskRound: proposal.currentTaskRound ?? proposal.lastTaskRound,
    })
    if (expected instanceof Error || target instanceof Error || !expected.equals(target))
      return new ConflictError("確認した休暇の判断対象が変わっています", "decision_target_changed")
    if (proposal.status === "cancelled") return { status: "cancelled", replayed: true }
    if (proposal.status !== "pending")
      return new ConflictError("承認待ちの休暇だけを取り消せます", "not_pending")
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "leave.request.cancelled",
      targetType: "leave.request",
      targetId: String(command.leaveRequestId),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ permission: "leave:submit" }),
      beforeJson: JSON.stringify({ status: "pending" }),
      afterJson: JSON.stringify({ status: "cancelled", decisionTarget: command.decisionTarget }),
      metadataJson: JSON.stringify(this.c.var.auditContext),
      occurredAt: command.cancelledAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("取消の監査を作成できません", { cause: audit })
    const cancelled = await repository.cancelProcedure({
      binding,
      actorAccountId: command.session.accountId,
      taskKey: command.decisionTarget.taskKey,
      taskRound: command.decisionTarget.taskRound,
      cancelledAt: command.cancelledAt,
      guards: [...human.assertions, companyGuard],
      audit,
    })
    if (cancelled !== true) {
      const current = await new SystemD1ProposalAdapter(this.c).findByNumber(binding.applicationId)
      const receipt = await repository.readSubmissionReceipt({
        binding,
        actorAccountId: command.session.accountId,
        guards: [...human.assertions, companyGuard],
      })
      if (
        !(current instanceof Error) &&
        current?.status === "cancelled" &&
        current.caseId === binding.caseId &&
        current.digest === binding.proposalDigest &&
        current.version === command.decisionTarget.proposalVersion &&
        current.lastTaskKey === command.decisionTarget.taskKey &&
        current.lastTaskRound === command.decisionTarget.taskRound &&
        receipt === true
      )
        return { status: "cancelled", replayed: true }
      return new ConflictError("保存までに取消条件が変わりました", "cancellation_changed", {
        cause: cancelled,
      })
    }
    return { status: "cancelled", replayed: false }
  }
}
