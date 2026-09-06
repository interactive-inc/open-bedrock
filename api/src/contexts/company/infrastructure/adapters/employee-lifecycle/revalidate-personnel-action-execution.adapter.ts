import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { PersonnelActionRequestRecord } from "@/contexts/company/domain/definitions/personnel-action-request-record.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import {
  CompanyForbiddenError,
  CompanyOperationError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { RevalidateCompanyProcedureAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-authority.adapter"
import { AccountEmployeeLinkReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/account-employee-link-read.adapter"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { RevalidateSystemExecutionAttestationsAdapter } from "@system/infrastructure/adapters/workflow/revalidate-system-execution-attestations.adapter"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = CompanyContext
type Input = Readonly<{
  request: PersonnelActionRequestRecord
  session: CompanyPersonnelSession
  executedAt: Date
}>

/** 承認された発令内容と、全段階の現在の判断資格を実行へ結び付ける。 */
export class RevalidatePersonnelActionExecutionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Input): Promise<ReadonlyArray<D1PreparedStatement> | CompanyOperationError> {
    const proposal = await new SystemD1ProposalAdapter(this.c).findByNumber(
      input.request.applicationId,
    )
    if (proposal instanceof Error)
      return new CompanyUnexpectedError("承認証跡を取得できません", { cause: proposal })
    const payload = CanonicalSystemJsonValue.create(input.request.action)
    if (
      proposal === null ||
      payload instanceof Error ||
      proposal.status !== "approved" ||
      proposal.caseId !== input.request.systemCaseId ||
      proposal.seriesId !== input.request.systemProposalSeriesId ||
      proposal.digest !== input.request.proposalDigest ||
      proposal.bodyJson !== payload.toString() ||
      proposal.completionOperationKey !== "company.personnel-action.apply"
    ) {
      return new CompanyForbiddenError("承認された発令内容を確認できません")
    }
    const policy = this.parsePolicy(proposal.decisionPolicyJson)
    if (policy instanceof Error || policy.workflow === null)
      return new CompanyForbiddenError("承認規程を確認できません")
    const evidence = await new RevalidateSystemExecutionAttestationsAdapter(this.c).prepare({
      caseId: proposal.caseId,
      executedAt: input.executedAt,
    })
    if (evidence instanceof Error)
      return new CompanyUnexpectedError("人の承認証跡を取得できません", { cause: evidence })
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({
      accountIds: [
        input.session.accountId,
        proposal.createdByAccountId,
        ...evidence.attestations.flatMap((attestation) => [
          attestation.actorAccountId,
          attestation.representedAccountId,
        ]),
      ],
      employeeCodes: policy.workflow.steps.flatMap((step) =>
        [...step.approvers, ...step.escalation_approvers].flatMap((selector) =>
          selector.type === "employee" ? [selector.employee_code] : [],
        ),
      ),
    })
    if (guard instanceof Error)
      return new CompanyUnexpectedError("会社資格を固定できません", { cause: guard })
    const excluded = new Set([input.request.requestedByEmployeeId, input.request.targetEmployeeId])
    const latestTasks = new Map(evidence.tasks.map((task) => [task.key, task]))
    if (
      latestTasks.size === 0 ||
      policy.workflow.steps.some(
        (step) => step.conditions.length === 0 && !latestTasks.has(step.key),
      )
    ) {
      return new CompanyForbiddenError("必要な承認段階がありません")
    }
    const validExecutors = new Set<AccountId>()
    for (const task of latestTasks.values()) {
      const step = policy.workflow.steps.find((candidate) => candidate.key === task.key)
      if (
        step === undefined ||
        task.outcome !== "approved" ||
        task.closedAt === null ||
        task.closedAt > input.executedAt
      ) {
        return new CompanyForbiddenError("承認段階が完了していません")
      }
      const approvals = new Set<EmployeeId>()
      const participants = new Set<EmployeeId>()
      const actors = new Set<EmployeeId>()
      for (const attestation of evidence.attestations.filter(
        (candidate) => candidate.taskKey === task.key && candidate.round === task.round,
      )) {
        const actor = await this.activeEmployee(attestation.actorAccountId, input.executedAt)
        const represented = await this.activeEmployee(
          attestation.representedAccountId,
          input.executedAt,
        )
        if (actor instanceof Error || represented instanceof Error)
          return new CompanyUnexpectedError("承認者の在籍を確認できません")
        if (
          actor === null ||
          represented === null ||
          excluded.has(actor) ||
          excluded.has(represented)
        )
          continue
        if (
          attestation.delegationId !== null &&
          (task.delegationPolicy === "forbidden" || !step.allow_delegation)
        )
          continue
        const qualified = await new RevalidateCompanyProcedureAuthorityAdapter(this.c).revalidate({
          step,
          task,
          payload: input.request.action,
          representedAccountId: attestation.representedAccountId,
          subjectEmployeeId: input.request.targetEmployeeId,
          targetDepartmentCode: input.request.targetDepartmentCode,
          excludedEmployeeIds: new Set(
            input.request.targetEmployeeId === null
              ? [input.request.requestedByEmployeeId]
              : [input.request.requestedByEmployeeId, input.request.targetEmployeeId],
          ),
          dueAt: task.dueAt,
          decidedAt: input.executedAt,
        })
        if (qualified instanceof Error)
          return new CompanyForbiddenError("実行時点の承認資格を確認できません", "forbidden", {
            cause: qualified,
          })
        if (!qualified || actors.has(actor) || participants.has(represented)) continue
        if (
          attestation.action === "return" ||
          (attestation.action === "reject" && task.negativeDecisionRule === "any-reject")
        ) {
          return new CompanyForbiddenError("有効な否定判断があります")
        }
        actors.add(actor)
        participants.add(represented)
        if (attestation.action === "approve") {
          approvals.add(represented)
          validExecutors.add(attestation.actorAccountId)
        }
      }
      if (
        approvals.size < task.requiredApprovals ||
        participants.size < task.requiredParticipants
      ) {
        return new CompanyForbiddenError("実行時点で承認の必要人数を満たしません")
      }
    }
    const executor = await this.activeEmployee(input.session.accountId, input.executedAt)
    if (executor !== input.session.employeeId || !validExecutors.has(input.session.accountId)) {
      return new CompanyForbiddenError("有効な承認者だけが人事発令を確定できます")
    }
    return [guard, evidence.guard]
  }

  private parsePolicy(value: string) {
    try {
      const input: unknown = JSON.parse(value)
      return parseCompanyProcedureDecisionPolicy(input)
    } catch (cause) {
      return new Error("invalid Company procedure policy", { cause })
    }
  }

  private async activeEmployee(
    accountId: AccountId,
    executedAt: Date,
  ): Promise<EmployeeId | null | Error> {
    const links = await new AccountEmployeeLinkReadAdapter(this.c).find({
      kind: "by_account",
      accountId: restoreWorkforceId("system_account", accountId),
    })
    if (!links.ok) return new Error("Company Account link is unavailable", { cause: links.cause })
    if (links.records.length !== 1) return null
    const employeeId = links.records[0]?.link.employeeId
    if (employeeId === undefined) return null
    const access = await new ResolveLiveEmployeeAccessAdapter({
      env: { ...this.c.env, NOW: executedAt.toISOString() },
    }).resolveLiveEmployeeAccess(employeeId)
    if (access instanceof Error) return access
    return access?.status === "ACTIVE" ? employeeId : null
  }
}
