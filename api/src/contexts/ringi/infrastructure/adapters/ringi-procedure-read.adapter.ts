import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"
import { RingiRequestRepository } from "@/contexts/ringi/infrastructure/repositories/ringi-request.repository"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ConflictError, ForbiddenError, NotFoundError, UnexpectedError } from "@/lib/errors"

type Context = CompanyContext
type Input = Readonly<{
  ringiId: number
  session: CompanyPersonnelSession
  tokenVersion: number
  at: Date
}>

/** 稟議の内容・判断対象・現在の操作資格を同じ案件から取得する。 */
export class RingiProcedureReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async find(input: Input) {
    const repository = new RingiRequestRepository(this.c)
    const request = await repository.findById(input.ringiId)
    if (request instanceof Error)
      return new UnexpectedError("稟議を取得できません", { cause: request })
    if (request === null) return new NotFoundError("稟議が見つかりません", "ringi_not_found")
    const binding = await repository.findProcedure(input.ringiId)
    if (binding instanceof Error)
      return new UnexpectedError("稟議の案件を取得できません", { cause: binding })
    const nextRingiId =
      binding === null
        ? null
        : await this.c.env.DB.prepare(
            "SELECT ringi_id FROM ringi_procedure_bindings WHERE previous_ringi_id = ?1",
          )
            .bind(input.ringiId)
            .first<number>("ringi_id")
    const query = new SystemD1ProposalAdapter(this.c)
    const proposal = binding === null ? null : await query.findByNumber(binding.applicationId)
    if (proposal instanceof Error)
      return new UnexpectedError("判断対象を取得できません", { cause: proposal })
    const payload = CanonicalSystemJsonValue.create(request.toProposalBody())
    if (
      binding !== null &&
      (proposal === null ||
        payload instanceof Error ||
        proposal.caseId !== binding.caseId ||
        proposal.digest !== binding.proposalDigest ||
        proposal.bodyJson !== payload.toString() ||
        proposal.completionOperationKey !== "ringi.request.authorize")
    )
      return new ConflictError("稟議と案件の内容が一致しません", "procedure_changed")
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
    let canDecide = false
    let canExecute = false
    let canReview = false
    if (proposal !== null && target !== null && input.session.hasPermission("ringi:approve")) {
      const human = await new SystemHumanOperationAuthorizationAdapter(this.c).prepare({
        accountId: input.session.accountId,
        tokenVersion: input.tokenVersion,
        permissions: ["ringi:approve"],
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
            subjectEmployeeId: request.applicantId,
            targetDepartmentCode: null,
            excludedEmployeeIds: new Set([request.applicantId]),
            action: "reject",
            decidedAt: input.at,
          })
          if (!(authority instanceof CompanyOperationError)) {
            guards = authority.guards
            canReview = true
            canDecide = !attestations.some(
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
            expectedPayload: request.toProposalBody(),
            completionOperationKey: "ringi.request.authorize",
            subjectEmployeeId: request.applicantId,
            targetDepartmentCode: null,
            excludedEmployeeIds: new Set([request.applicantId]),
            executorAccountId: input.session.accountId,
            executorEmployeeId: input.session.employeeId,
            executedAt: input.at,
          })
          if (!(authority instanceof CompanyOperationError)) {
            guards = authority
            canReview = true
            canExecute = true
          }
        } else {
          canReview = attestations.some(
            (witness) => witness.actorAccountId === input.session.accountId,
          )
        }
        if (canReview) {
          try {
            await this.c.env.DB.batch([...human.assertions, ...guards])
          } catch (cause) {
            return new ConflictError("参照中に判断資格が変わりました", "authority_changed", {
              cause,
            })
          }
        }
      }
    }
    const isOwner = request.applicantId === input.session.employeeId
    if (!isOwner && !input.session.hasPermission("ringi:read:all") && !canReview)
      return new ForbiddenError("この稟議を参照する権限がありません", "forbidden")
    const directory = new CompanyEmployeeDirectoryReadAdapter(this.c)
    const people = await directory.findForEmployeeIds([request.applicantId, request.approverId])
    if (people instanceof Error)
      return new UnexpectedError("稟議の関係者を取得できません", { cause: people })
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
    return {
      id: input.ringiId,
      applicant_id: request.applicantId,
      applicant_name:
        people.find((person) => person.id === request.applicantId)?.officialName ?? "",
      applicant_dept_name:
        people.find((person) => person.id === request.applicantId)?.primaryAssignment
          ?.organizationUnitName ?? null,
      approver_id: request.approverId,
      approver_name: people.find((person) => person.id === request.approverId)?.officialName ?? "",
      title: request.title,
      amount: request.amount,
      reason: request.reason,
      status,
      created_at: request.createdAt,
      decided_at: request.decidedAt,
      decision_comment: request.decisionComment,
      procedure_required: binding === null && request.status === "pending",
      application_id: binding?.applicationId ?? null,
      can_submit_legacy:
        isOwner &&
        binding === null &&
        request.status === "pending" &&
        input.session.hasPermission("ringi:submit"),
      next_ringi_id: nextRingiId,
      previous_ringi_id: binding?.previousRingiId ?? null,
      decision_target: target,
      can_decide: canDecide,
      can_execute: canExecute,
      can_cancel:
        isOwner && proposal?.status === "pending" && input.session.hasPermission("ringi:submit"),
      can_resubmit:
        isOwner &&
        nextRingiId === null &&
        proposal?.status === "returned" &&
        input.session.hasPermission("ringi:submit"),
      required_approvals: currentTask?.requiredApprovals ?? null,
      approvals: votes.filter((witness) => witness.action === "approve").length,
      decisions: attestations.map((witness) => ({
        task_key: witness.taskKey,
        task_round: witness.round,
        action: witness.action,
        comment: witness.comment,
        decided_at: witness.decidedAt.toISOString(),
      })),
    }
  }
}
