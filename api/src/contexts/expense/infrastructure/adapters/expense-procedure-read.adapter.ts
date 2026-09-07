import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"
import { ExpenseProcedureRepository } from "@/contexts/expense/infrastructure/repositories/expense-procedure.repository"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { PrepareExpenseApprovalScopeAdapter } from "@/contexts/expense/infrastructure/adapters/prepare-expense-approval-scope.adapter"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

type Context = CompanyContext
type Input = Readonly<{
  expenseId: number
  session: CompanyPersonnelSession
  tokenVersion: number
  at: Date
}>

/** 経費の内容・判断対象・現在の操作資格を同じ案件から取得する。 */
export class ExpenseProcedureReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async find(input: Input) {
    const repository = new ExpenseProcedureRepository(this.c)
    const request = await repository.findById(input.expenseId)
    if (request instanceof Error)
      return new UnexpectedError("経費を取得できません", { cause: request })
    if (request === null) return new NotFoundError("経費が見つかりません", "expense_not_found")
    const binding = await repository.findProcedure(input.expenseId)
    if (binding instanceof Error)
      return new UnexpectedError("経費の案件を取得できません", { cause: binding })
    const nextExpenseId =
      binding === null
        ? null
        : await this.c.env.DB.prepare(
            "SELECT expense_id FROM expense_procedure_bindings WHERE previous_expense_id = ?1",
          )
            .bind(input.expenseId)
            .first<number>("expense_id")
    const query = new SystemD1ProposalAdapter(this.c)
    const proposal = binding === null ? null : await query.findByNumber(binding.applicationId)
    if (proposal instanceof Error)
      return new UnexpectedError("判断対象を取得できません", { cause: proposal })
    const payload = CanonicalSystemJsonValue.create(
      request.toProposalBody(binding?.attachments ?? []),
    )
    if (
      binding !== null &&
      (proposal === null ||
        payload instanceof Error ||
        proposal.caseId !== binding.caseId ||
        proposal.digest !== binding.proposalDigest ||
        proposal.bodyJson !== payload.toString() ||
        proposal.completionOperationKey !== "expense.request.authorize")
    )
      return new ConflictError("経費と案件の内容が一致しません", "procedure_changed")
    const target =
      proposal === null
        ? null
        : {
            proposal_version: proposal.version,
            proposal_digest: proposal.digest,
            task_key: proposal.currentTaskKey ?? proposal.lastTaskKey,
            task_round: proposal.currentTaskRound ?? proposal.lastTaskRound,
          }
    const attestations = proposal === null ? [] : await query.listAttestations(proposal.caseId)
    if (attestations instanceof Error)
      return new UnexpectedError("判断記録を取得できません", { cause: attestations })
    const tasks = proposal === null ? [] : await query.listTasks(proposal.caseId)
    if (tasks instanceof Error)
      return new UnexpectedError("判断段階を取得できません", { cause: tasks })
    const evidence = binding === null ? null : await repository.prepareEvidence(binding, input.at)
    const evidenceAvailable = !(evidence instanceof Error)
    const scope =
      binding === null
        ? null
        : await new PrepareExpenseApprovalScopeAdapter(this.c).prepare({
            organizationUnitId: request.organizationUnitId,
            at: input.at,
          })
    let canDecide = false
    let canExecute = false
    let canReview = false
    if (proposal !== null && target !== null && input.session.hasPermission("expense:approve")) {
      const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
        accountId: input.session.accountId,
        tokenVersion: input.tokenVersion,
        permissions: ["expense:approve"],
        now: input.at,
      })
      if (human instanceof Error)
        return new UnexpectedError("判断権限を確認できません", { cause: human })
      if (human !== "forbidden") {
        let guards: ReadonlyArray<D1PreparedStatement> = []
        if (proposal.status === "pending") {
          const authority = await new PrepareCompanyProcedureDecisionAdapter(this.c).prepare({
            proposal,
            decisionTarget: {
              proposalVersion: target.proposal_version,
              proposalDigest: target.proposal_digest,
              taskKey: target.task_key,
              taskRound: target.task_round,
            },
            actorAccountId: input.session.accountId,
            actorEmployeeId: input.session.employeeId,
            subjectEmployeeId: request.employeeId,
            targetDepartmentCode:
              scope instanceof Error || scope === null ? null : scope.targetDepartmentCode,
            excludedEmployeeIds: new Set([request.employeeId]),
            action: "reject",
            decidedAt: input.at,
          })
          if (
            !(authority instanceof CompanyOperationError) &&
            !(scope instanceof Error) &&
            scope !== null
          ) {
            guards = [...authority.guards, scope.guard]
            canReview = true
            canDecide =
              evidenceAvailable &&
              !attestations.some(
                (witness) =>
                  witness.taskKey === target.task_key &&
                  witness.round === target.task_round &&
                  (witness.actorAccountId === input.session.accountId ||
                    witness.representedAccountId === authority.representedAccountId),
              )
          }
        } else if (proposal.status === "approved" && binding !== null) {
          const authority = await new RevalidateCompanyProcedureExecutionAdapter(this.c).prepare({
            applicationId: binding.applicationId,
            expectedCaseId: binding.caseId,
            expectedSeriesId: binding.seriesId,
            expectedProposalDigest: binding.proposalDigest,
            expectedPayload: request.toProposalBody(binding?.attachments ?? []),
            completionOperationKey: "expense.request.authorize",
            subjectEmployeeId: request.employeeId,
            targetDepartmentCode:
              scope instanceof Error || scope === null ? null : scope.targetDepartmentCode,
            excludedEmployeeIds: new Set([request.employeeId]),
            executorAccountId: input.session.accountId,
            executorEmployeeId: input.session.employeeId,
            executedAt: input.at,
          })
          if (
            !(authority instanceof CompanyOperationError) &&
            !(scope instanceof Error) &&
            scope !== null
          ) {
            guards = [...authority, scope.guard]
            canReview = true
            canExecute = evidenceAvailable
          }
        } else {
          canReview = attestations.some(
            (witness) => witness.actorAccountId === input.session.accountId,
          )
        }
        if (canReview) {
          try {
            await this.c.env.DB.batch([
              ...human.assertions,
              ...guards,
              ...(evidence instanceof Error || evidence === null ? [] : evidence),
            ])
          } catch (cause) {
            return new ConflictError("参照中に判断資格が変わりました", "authority_changed", {
              cause,
            })
          }
        }
      }
    }
    const isOwner = request.employeeId === input.session.employeeId
    if (!isOwner && !input.session.hasPermission("expense:read:all") && !canReview)
      return new ForbiddenError("この経費を参照する権限がありません", "forbidden")
    const directory = new CompanyEmployeeDirectoryReadAdapter(this.c)
    const people = await directory.findForEmployeeIds([request.employeeId])
    if (people instanceof Error)
      return new UnexpectedError("経費の関係者を取得できません", { cause: people })
    const currentTask = tasks.find(
      (task) => task.key === target?.task_key && task.round === target?.task_round,
    )
    const votes = attestations.filter(
      (witness) => witness.taskKey === target?.task_key && witness.round === target?.task_round,
    )
    const status =
      proposal?.status === "returned" || proposal?.status === "cancelled"
        ? proposal.status
        : proposal?.status === "approved" && request.status === "pending"
          ? "awaiting_execution"
          : request.status
    const attachmentIds = await repository.readAttachmentIds(input.expenseId)
    if (attachmentIds instanceof Error)
      return new UnexpectedError("添付を取得できません", { cause: attachmentIds })
    const storedAttachments =
      binding === null ? await new AttachmentAdapter(this.c).findManyByIds(attachmentIds) : null
    if (storedAttachments instanceof Error)
      return new UnexpectedError("添付を取得できません", { cause: storedAttachments })
    const attachments =
      binding === null
        ? (storedAttachments ?? []).map((row) => ({
            id: row.id,
            file_name: row.fileName,
            content_type: row.contentType,
            byte_size: row.byteSize,
            sha256: row.plaintextSha256,
          }))
        : binding.attachments.map((row) => ({
            id: row.id,
            file_name: row.fileName,
            content_type: row.contentType,
            byte_size: row.byteSize,
            sha256: row.sha256,
          }))
    return {
      id: input.expenseId,
      employee_id: request.employeeId,
      organization_unit_id: request.organizationUnitId,
      organization_unit_name: scope instanceof Error || scope === null ? null : scope.name,
      evidence_available: evidenceAvailable,
      attachments,
      applicant_id: request.employeeId,
      applicant_name: people.find((person) => person.id === request.employeeId)?.officialName ?? "",
      applicant_dept_name:
        people.find((person) => person.id === request.employeeId)?.primaryAssignment
          ?.organizationUnitName ?? null,
      category: request.category,
      spent_at: request.spentAt,
      amount: request.amount,
      note: request.note,
      status,
      created_at: request.createdAt,
      procedure_required: binding === null && request.status === "pending",
      application_id: binding?.applicationId ?? null,
      can_submit_legacy:
        isOwner &&
        binding === null &&
        request.status === "pending" &&
        input.session.hasPermission("expense:submit"),
      next_expense_id: nextExpenseId,
      previous_expense_id: binding?.previousExpenseId ?? null,
      decision_target: target,
      can_decide: canDecide,
      can_execute: canExecute,
      can_cancel:
        isOwner && proposal?.status === "pending" && input.session.hasPermission("expense:submit"),
      can_resubmit:
        isOwner &&
        nextExpenseId === null &&
        proposal?.status === "returned" &&
        input.session.hasPermission("expense:submit"),
      required_approvals: currentTask?.requiredApprovals ?? null,
      approvals: votes.filter((witness) => witness.action === "approve").length,
      decisions: attestations.map((witness) => ({
        id: witness.id,
        task_key: witness.taskKey,
        task_round: witness.round,
        action: witness.action,
        comment: witness.comment,
        decided_at: witness.decidedAt.toISOString(),
      })),
    }
  }
}
