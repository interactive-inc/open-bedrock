import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/repositories/ringi-request.repository"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnexpectedError,
  type ApplicationError,
} from "@/lib/errors"

type Context = CompanyContext
type Command = Readonly<{
  ringiId: number
  session: CompanyPersonnelSession
  tokenVersion: number
  decisionTarget: Readonly<{
    proposalVersion: number
    proposalDigest: string
    taskKey: string
    taskRound: number
  }>
  action: "approve" | "reject"
  comment: string | null
  decidedAt: Date
}>
type Result = Readonly<{
  status: "pending" | "approved" | "rejected" | "returned"
  needsExecution: boolean
  replayed: boolean
}>

/** 表示した稟議への判断を現在の会社資格で記録し、必要人数と次の段階を反映する。 */
export class RecordRingiDecision {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Result | ApplicationError> {
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["ringi:approve"],
      now: command.decidedAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("稟議を判断する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("判断権限を確認できません", { cause: human })
    const repository = new RingiRequestRepository(this.c)
    const request = await repository.findById(command.ringiId)
    if (request instanceof Error)
      return new UnexpectedError("稟議を取得できません", { cause: request })
    if (request === null) return new NotFoundError("稟議が見つかりません", "not_found")
    const binding = await repository.findProcedure(command.ringiId)
    if (binding instanceof Error)
      return new UnexpectedError("承認案件を取得できません", { cause: binding })
    if (binding === null)
      return new ConflictError("会社の承認規程へ提出してください", "procedure_required")
    const proposal = await new SystemD1ProposalAdapter(this.c).findByNumber(binding.applicationId)
    const payload = CanonicalSystemJsonValue.create(request.toProposalBody())
    if (proposal instanceof Error || payload instanceof Error)
      return new UnexpectedError("稟議内容を確認できません")
    if (
      proposal === null ||
      proposal.caseId !== binding.caseId ||
      proposal.seriesId !== binding.seriesId ||
      proposal.digest !== binding.proposalDigest ||
      proposal.bodyJson !== payload.toString() ||
      proposal.completionOperationKey !== "ringi.request.authorize"
    )
      return new ConflictError("稟議と承認対象が一致しません", "decision_target_changed")
    const receiptInput = {
      binding,
      actorAccountId: command.session.accountId,
      decisionTarget: command.decisionTarget,
      action: command.action,
      comment: command.comment,
      guards: human.assertions,
    }
    const receipt = await repository.findDecisionReceipt(receiptInput)
    if (receipt instanceof Error)
      return new ForbiddenError("判断結果を取得する権限を確認できません", "forbidden", {
        cause: receipt,
      })
    if (receipt === "different")
      return new ConflictError("同じ判断対象に別の判断を送っています", "decision_conflict")
    if (receipt === "matching") {
      if (proposal.status === "cancelled")
        return new ConflictError("稟議は取り消されています", "decision_changed")
      return {
        status: proposal.status === "executed" ? "approved" : proposal.status,
        needsExecution: proposal.status === "approved",
        replayed: true,
      }
    }
    const prepared = await new PrepareCompanyProcedureDecisionAdapter(this.c).prepare({
      proposal,
      decisionTarget: command.decisionTarget,
      actorAccountId: command.session.accountId,
      actorEmployeeId: command.session.employeeId,
      subjectEmployeeId: request.applicantId,
      excludedEmployeeIds: new Set([request.applicantId]),
      targetDepartmentCode: null,
      action: command.action,
      decidedAt: command.decidedAt,
    })
    if (prepared instanceof CompanyConflictError)
      return new ConflictError(prepared.message, prepared.code)
    if (prepared instanceof CompanyUnexpectedError)
      return new UnexpectedError(prepared.message, { cause: prepared })
    if (prepared instanceof CompanyOperationError)
      return new ForbiddenError(prepared.message, prepared.code)
    const attestation = HumanAttestationEntity.create({
      id: crypto.randomUUID(),
      caseId: prepared.caseId,
      taskKey: prepared.taskKey,
      round: prepared.round,
      actorAccountId: prepared.actorAccountId,
      representedAccountId: prepared.representedAccountId,
      delegationId: prepared.delegationId,
      action: prepared.action,
      proposalDigest: prepared.proposalDigest,
      comment: command.comment,
      decidedAt: command.decidedAt,
    })
    if (attestation instanceof Error)
      return new UnexpectedError("判断記録を作成できません", { cause: attestation })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: `ringi.request.${prepared.action}`,
      targetType: "ringi.request",
      targetId: String(command.ringiId),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permission: "ringi:approve",
        representedAccountId: prepared.representedAccountId,
        delegationId: prepared.delegationId,
      }),
      beforeJson: null,
      afterJson: JSON.stringify({
        attestationId: attestation.id,
        decisionTarget: command.decisionTarget,
      }),
      metadataJson: JSON.stringify(this.c.var.auditContext),
      occurredAt: command.decidedAt,
    })
    if (audit instanceof Error)
      return new UnexpectedError("判断監査を作成できません", { cause: audit })
    const saved = await repository.recordDecision({
      binding,
      attestation,
      nextTask: prepared.nextTask,
      guards: [...human.assertions, ...prepared.guards],
      audit,
    })
    if (saved instanceof Error) {
      const concurrent = await repository.findDecisionReceipt(receiptInput)
      if (concurrent === "matching") {
        const current = await new SystemD1ProposalAdapter(this.c).findByNumber(
          binding.applicationId,
        )
        if (current !== null && !(current instanceof Error) && current.status !== "cancelled")
          return {
            status: current.status === "executed" ? "approved" : current.status,
            needsExecution: current.status === "approved",
            replayed: true,
          }
      }
      return new ConflictError("保存までに判断条件が変わりました", "decision_changed", {
        cause: saved,
      })
    }
    return {
      status: saved.caseStatus,
      needsExecution: saved.caseStatus === "approved",
      replayed: false,
    }
  }
}
