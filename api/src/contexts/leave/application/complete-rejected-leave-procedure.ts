import { PrepareLeaveHumanEmployeeAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-human-employee.adapter"
import type { Context } from "@/env"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { LeaveRequestRepository } from "@/contexts/leave/infrastructure/repositories/leave-request.repository"
import { LeaveProcedureRepository } from "@/contexts/leave/infrastructure/repositories/leave-procedure.repository"
import { LeaveDecisionNotificationValue } from "@/contexts/leave/domain/values/leave-decision-notification.value"
import { PrepareLeaveDecisionNotificationAdapter } from "@/contexts/leave/infrastructure/adapters/prepare-leave-decision-notification.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ConflictError, ForbiddenError, UnexpectedError, type ApplicationError } from "@/lib/errors"

type Command = Readonly<{
  leaveRequestId: number
  session: CompanyPersonnelSession
  tokenVersion: number
  completedAt: Date
}>

/** 確定済みの却下を、その判断者が休暇記録と通知へ反映する。新たな決裁は行わない。 */
export class CompleteRejectedLeaveProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: Command,
  ): Promise<Readonly<{ status: "rejected"; replayed: boolean }> | ApplicationError> {
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["leave:approve"],
      now: command.completedAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("休暇を確定する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("確定権限を確認できません", { cause: human })
    const qualified = await new PrepareLeaveHumanEmployeeAdapter(this.c).prepare({
      accountId: command.session.accountId,
      employeeId: command.session.employeeId,
      now: command.completedAt,
    })
    if (qualified instanceof Error) return qualified
    const { employee: actor, guard } = qualified
    const requests = new LeaveRequestRepository(this.c)
    const repository = new LeaveProcedureRepository(this.c)
    const request = await requests.findById(command.leaveRequestId)
    const binding = await repository.findForRequest(command.leaveRequestId)
    if (request instanceof Error || binding instanceof Error)
      return new UnexpectedError("休暇の承認案件を取得できません")
    if (request === null || binding === null)
      return new ConflictError("休暇の承認案件がありません", "procedure_required")
    if (request.employeeId === actor.id)
      return new ForbiddenError("本人の休暇は確定できません", "forbidden")
    const proposal = await new SystemD1ProposalAdapter(this.c).findByNumber(binding.applicationId)
    const payload = CanonicalSystemJsonValue.create(request.toProposalBody())
    if (proposal instanceof Error || payload instanceof Error)
      return new UnexpectedError("却下内容を確認できません")
    if (
      proposal === null ||
      proposal.status !== "rejected" ||
      !Number.isSafeInteger(command.completedAt.getTime()) ||
      proposal.updatedAt > command.completedAt ||
      proposal.caseId !== binding.caseId ||
      proposal.seriesId !== binding.seriesId ||
      proposal.digest !== binding.proposalDigest ||
      proposal.bodyJson !== payload.toString() ||
      proposal.completionOperationKey !== "leave.request.authorize"
    )
      return new ConflictError("確定した却下内容と一致しません", "decision_changed")
    const guards = [...human.assertions, guard]
    const evidence = await repository.readRejectionEvidence({
      binding,
      actorAccountId: command.session.accountId,
      guards,
    })
    if (evidence instanceof Error)
      return new ForbiddenError("却下の証跡を確認できません", "forbidden", { cause: evidence })
    if (evidence === null)
      return new ForbiddenError("却下を記録した本人だけが確定できます", "forbidden")
    if (request.status === "rejected") {
      if (request.approverId !== actor.id || request.decidedComment !== evidence.comment)
        return new ConflictError("別の判断者が休暇を確定しています", "already_decided")
      return { status: "rejected", replayed: true }
    }
    if (request.status !== "pending")
      return new ConflictError("休暇は確定できません", "already_decided")
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "leave.request.rejection-completed",
      targetType: "leave.request",
      targetId: String(command.leaveRequestId),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permission: "leave:approve",
        caseId: binding.caseId,
        attestationId: evidence.id,
      }),
      beforeJson: JSON.stringify({ status: "pending" }),
      afterJson: JSON.stringify({ status: "rejected" }),
      metadataJson: JSON.stringify({ ...this.c.var.auditContext, actorEmployeeId: actor.id }),
      occurredAt: command.completedAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("却下の監査を作成できません", { cause: audit })
    const notification = LeaveDecisionNotificationValue.create({
      decisionAuditId: audit.eventId,
      leaveRequestId: command.leaveRequestId,
      recipientEmployeeId: request.employeeId,
      outcome: "rejected",
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
    const saved = await repository.completeRejection({
      binding,
      attestationId: evidence.id,
      approverId: actor.id,
      guards,
      audit,
      notification: queued,
    })
    if (saved === true) return { status: "rejected", replayed: false }
    const current = await requests.findById(command.leaveRequestId)
    if (
      !(current instanceof Error) &&
      current?.status === "rejected" &&
      current.approverId === actor.id &&
      current.decidedComment === evidence.comment
    ) {
      const receipt = await repository.readRejectionEvidence({
        binding,
        actorAccountId: command.session.accountId,
        guards,
      })
      if (receipt !== null && !(receipt instanceof Error))
        return { status: "rejected", replayed: true }
    }
    return new ConflictError("保存までに却下の確定条件が変わりました", "decision_changed", {
      cause: saved,
    })
  }
}
