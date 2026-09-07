import { PrepareExpenseApprovalScopeAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-approval-scope.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
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
  expenseId: number
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

/** 表示した経費への判断を現在の会社資格で記録し、必要人数と次の段階を反映する。 */
export class RecordExpenseDecision {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: Command): Promise<Result | ApplicationError> {
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["expense:approve"],
      now: command.decidedAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("経費を判断する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("判断権限を確認できません", { cause: human })
    const repository = new ExpenseProcedureRepository(this.c)
    const request = await repository.findById(command.expenseId)
    if (request instanceof Error)
      return new UnexpectedError("経費を取得できません", { cause: request })
    if (request === null) return new NotFoundError("経費が見つかりません", "not_found")
    const binding = await repository.findProcedure(command.expenseId)
    if (binding instanceof Error)
      return new UnexpectedError("承認案件を取得できません", { cause: binding })
    if (binding === null)
      return new ConflictError("会社の承認規程へ提出してください", "procedure_required")
    const proposal = await new SystemD1ProposalAdapter(this.c).findByNumber(binding.applicationId)
    const payload = CanonicalSystemJsonValue.create(request.toProposalBody(binding.attachments))
    if (proposal instanceof Error || payload instanceof Error)
      return new UnexpectedError("経費内容を確認できません")
    if (
      proposal === null ||
      proposal.caseId !== binding.caseId ||
      proposal.seriesId !== binding.seriesId ||
      proposal.digest !== binding.proposalDigest ||
      proposal.bodyJson !== payload.toString() ||
      proposal.completionOperationKey !== "expense.request.authorize"
    )
      return new ConflictError("経費と承認対象が一致しません", "decision_target_changed")
    const evidenceGuards = await repository.prepareEvidence(binding, command.decidedAt)
    if (evidenceGuards instanceof Error)
      return new ConflictError("確認した添付を利用できません", "attachment_evidence_changed", {
        cause: evidenceGuards,
      })
    const receiptInput = {
      binding,
      actorAccountId: command.session.accountId,
      decisionTarget: command.decisionTarget,
      action: command.action,
      comment: command.comment,
      guards: [...human.assertions, ...evidenceGuards],
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
        return new ConflictError("経費は取り消されています", "decision_changed")
      return {
        status: proposal.status === "executed" ? "approved" : proposal.status,
        needsExecution: proposal.status === "approved",
        replayed: true,
      }
    }
    const scope = await new PrepareExpenseApprovalScopeAdapter(this.c).prepare({
      organizationUnitId: request.organizationUnitId,
      at: command.decidedAt,
    })
    if (scope instanceof Error)
      return new ConflictError("負担組織を確認できません", "organization_scope_changed", {
        cause: scope,
      })
    const prepared = await new PrepareCompanyProcedureDecisionAdapter(this.c).prepare({
      proposal,
      decisionTarget: command.decisionTarget,
      actorAccountId: command.session.accountId,
      actorEmployeeId: command.session.employeeId,
      subjectEmployeeId: request.employeeId,
      excludedEmployeeIds: new Set([request.employeeId]),
      targetDepartmentCode: scope.targetDepartmentCode,
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
      action: `expense.request.${prepared.action}`,
      targetType: "expense.request",
      targetId: String(command.expenseId),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permission: "expense:approve",
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
      guards: [...human.assertions, scope.guard, ...prepared.guards, ...evidenceGuards],
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
