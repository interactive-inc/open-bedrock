import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemDecisionTargetValue } from "@system/domain/values/workflow/system-decision-target.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { ConflictError, ForbiddenError, UnexpectedError, type ApplicationError } from "@/lib/errors"

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
  cancelledAt: Date
}>

/** 本人が確認した承認待ちの経費を取り消し、判断と取消の同時確定を防ぐ。 */
export class CancelExpenseProcedure {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async run(
    command: Command,
  ): Promise<Readonly<{ status: "cancelled"; replayed: boolean }> | ApplicationError> {
    const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
      accountId: command.session.accountId,
      tokenVersion: command.tokenVersion,
      permissions: ["expense:submit"],
      now: command.cancelledAt,
    })
    if (human === "forbidden")
      return new ForbiddenError("経費を取り消す権限がありません", "forbidden")
    if (human instanceof Error)
      return new UnexpectedError("取消権限を確認できません", { cause: human })
    const repository = new ExpenseProcedureRepository(this.c)
    const companyGuard = await repository.prepareSubmissionGuard(command.session.accountId)
    if (companyGuard instanceof Error)
      return new UnexpectedError("会社資格を固定できません", { cause: companyGuard })
    const people = await new CompanyEmployeeDirectoryReadAdapter({
      env: { ...this.c.env, NOW: command.cancelledAt.toISOString() },
    }).findForAccountIds([command.session.accountId])
    if (people instanceof Error)
      return new UnexpectedError("取消者の在籍を取得できません", { cause: people })
    if (
      people.length !== 1 ||
      people[0]?.employee.id !== command.session.employeeId ||
      people[0].employee.employment?.status !== "ACTIVE"
    )
      return new ForbiddenError("在籍中の本人だけが取り消せます", "forbidden")
    const binding = await repository.findProcedure(command.expenseId)
    if (binding instanceof Error)
      return new UnexpectedError("経費の案件を取得できません", { cause: binding })
    if (binding === null)
      return new ConflictError("経費を承認規程へ提出してください", "procedure_required")
    const proposal = await new SystemD1ProposalAdapter(this.c).findByNumber(binding.applicationId)
    if (proposal instanceof Error || proposal === null)
      return new UnexpectedError("経費の提案を取得できません")
    const owned = await repository.readSubmissionReceipt({
      expenseId: binding.expenseId,
      actorAccountId: command.session.accountId,
      previousExpenseId: binding.previousExpenseId,
      guards: [...human.assertions, companyGuard],
    })
    if (owned !== true) return new ForbiddenError("本人の経費だけを取り消せます", "forbidden")
    const expected = SystemDecisionTargetValue.create(command.decisionTarget)
    const target = SystemDecisionTargetValue.create({
      proposalVersion: proposal.version,
      proposalDigest: proposal.digest,
      taskKey: proposal.currentTaskKey ?? proposal.lastTaskKey,
      taskRound: proposal.currentTaskRound ?? proposal.lastTaskRound,
    })
    if (expected instanceof Error || target instanceof Error || !expected.equals(target))
      return new ConflictError("確認した経費の判断対象が変わっています", "decision_target_changed")
    if (proposal.status === "cancelled") return { status: "cancelled", replayed: true }
    if (proposal.status !== "pending")
      return new ConflictError("承認待ちの経費だけを取り消せます", "not_pending")
    const audit = SystemAuditEventEntity.create({
      actorAccountId: command.session.accountId,
      action: "expense.request.cancelled",
      targetType: "expense.request",
      targetId: String(command.expenseId),
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ permission: "expense:submit" }),
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
        expenseId: binding.expenseId,
        actorAccountId: command.session.accountId,
        previousExpenseId: binding.previousExpenseId,
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
