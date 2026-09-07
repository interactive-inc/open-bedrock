import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
import type { ExpenseProcedureBinding } from "@/contexts/expense/domain/definitions/expense-procedure.definition"
import type { Expense } from "@/contexts/expense/domain/entities/expense.entity"
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

type Context = CompanyContext
type Command = Readonly<{
  expenseId: number
  session: CompanyPersonnelSession
  tokenVersion: number
  completedAt: Date
}>

/** 全段階の現在の承認資格を確認し、経費の決裁結果を一度だけ確定する。 */
export class CompleteApprovedExpenseProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(
    command: Command,
  ): Promise<Readonly<{ status: "approved"; replayed: boolean }> | ApplicationError> {
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["expense:approve"],
      now: command.completedAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("経費を確定する権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("経費の実行権限を確認できません", { cause: human })
    const repository = new ExpenseProcedureRepository(this.c)
    const request = await repository.findById(command.expenseId)
    if (request instanceof Error)
      return new UnexpectedError("経費を取得できません", { cause: request })
    if (request === null) return new NotFoundError("経費が見つかりません", "expense_not_found")
    const binding = await repository.findProcedure(command.expenseId)
    if (binding instanceof Error)
      return new UnexpectedError("経費の承認案件を取得できません", { cause: binding })
    if (binding === null)
      return new ConflictError("経費を承認案件へ接続する必要があります", "procedure_required")
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
      return new ConflictError("経費は確定できません", "already_decided")
    const evidenceGuards = await repository.prepareEvidence(binding, command.completedAt)
    if (evidenceGuards instanceof Error)
      return new ConflictError("確認した添付を利用できません", "attachment_evidence_changed", {
        cause: evidenceGuards,
      })
    const guards = await new RevalidateCompanyProcedureExecutionAdapter(this.c).prepare({
      applicationId: binding.applicationId,
      expectedCaseId: binding.caseId,
      expectedSeriesId: binding.seriesId,
      expectedProposalDigest: binding.proposalDigest,
      expectedPayload: request.toProposalBody(binding.attachments),
      completionOperationKey: "expense.request.authorize",
      subjectEmployeeId: request.employeeId,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set([request.employeeId]),
      executorAccountId: command.session.accountId,
      executorEmployeeId: command.session.employeeId,
      executedAt: command.completedAt,
    })
    if (guards instanceof CompanyOperationError)
      return new ForbiddenError("経費の現在の承認資格を確認できません", "forbidden", {
        cause: guards,
      })
    const authorization = ExecutionAuthorizationEntity.create({
      id: crypto.randomUUID(),
      caseId: binding.caseId,
      operationKey: "expense.request.authorize",
      proposalDigest: binding.proposalDigest,
      grantedToAccountId: command.session.accountId,
      grantedAt: command.completedAt,
      expiresAt: new Date(command.completedAt.getTime() + 300_000),
      usedAt: null,
    })
    if (authorization instanceof Error)
      return new UnexpectedError("経費の実行許可を作成できません", { cause: authorization })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "expense.request.authorized",
      targetType: "expense.request",
      targetId: String(command.expenseId),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        permission: "expense:approve",
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
      return new UnexpectedError("経費の実行監査を作成できません", { cause: audit })
    const executed = await repository.executeAuthorized({
      binding,
      authorization,
      guards: [...human.assertions, ...guards, ...evidenceGuards],
      audit,
      decidedAt: command.completedAt,
      comment: null,
    })
    if (executed === true) return { status: "approved", replayed: false }
    const current = await repository.findById(command.expenseId)
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
    return new ConflictError("保存までに経費の実行条件が変わりました", "execution_changed", {
      cause: executed,
    })
  }

  private async replay(
    input: Readonly<{
      request: Expense
      binding: ExpenseProcedureBinding
      verifyReceipt: () => Promise<boolean | Error>
    }>,
  ): Promise<Readonly<{ status: "approved"; replayed: true }> | ApplicationError> {
    const request = input.request
    const binding = input.binding
    const proposal = await new SystemD1ProposalAdapter(this.c).findByNumber(binding.applicationId)
    const payload = CanonicalSystemJsonValue.create(request.toProposalBody(binding.attachments))
    if (
      proposal instanceof Error ||
      payload instanceof Error ||
      proposal === null ||
      proposal.status !== "executed" ||
      proposal.caseId !== binding.caseId ||
      proposal.seriesId !== binding.seriesId ||
      proposal.digest !== binding.proposalDigest ||
      proposal.bodyJson !== payload.toString() ||
      proposal.completionOperationKey !== "expense.request.authorize"
    )
      return new ConflictError("確定済みの経費内容を確認できません", "execution_changed")
    const receipt = await input.verifyReceipt()
    if (receipt instanceof Error)
      return new ForbiddenError("確定結果を取得する権限が変わりました", "forbidden", {
        cause: receipt,
      })
    if (!receipt) return new ConflictError("別の実行者が経費を確定しています", "already_decided")
    return { status: "approved", replayed: true }
  }
}
