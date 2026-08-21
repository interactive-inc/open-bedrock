import type { SystemTaskPersistence } from "@system/infrastructure/workflow/system-workflow-writer.repository"
import type { AccountId } from "@system/domain/auth/account-id"
import { DecisionTaskCandidate } from "@system/domain/workflow/decision-task-candidate.entity"
import { DecisionTask } from "@system/domain/workflow/decision-task.entity"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import type { ProposalDigest } from "@system/domain/workflow/system-case-reference"
import type { SystemCase } from "@system/domain/workflow/system-case.entity"

export type StartSystemProcedureTaskCandidate = Readonly<{
  accountId: AccountId
  source: "primary" | "escalation"
  evidenceContext: string
  evidenceKind: string
  evidenceId: string
  evidenceVersion: string
  eligibilityDigest: ProposalDigest
  eligibleFrom: Date | null
  resolvedAt: Date
}>

export type StartSystemProcedureTask = Readonly<{
  key: string
  requiredApprovals: number
  openedAt: Date
  dueAt: Date | null
  candidates: ReadonlyArray<StartSystemProcedureTaskCandidate>
  excludedAccountIds: ReadonlyArray<AccountId>
}>

/** 解決済み候補を検証し、永続化する一つのSystem判断Taskへ変換する。 */
export function createSystemTaskPersistence(
  input: Readonly<{
    task: StartSystemProcedureTask
    caseId: SystemCase["id"]
    createdByAccountId: AccountId
    proposalDigest: ProposalDigest
    round?: number
  }>,
): SystemTaskPersistence | InvalidSystemWorkflowError {
  const candidates: DecisionTaskCandidate[] = []
  for (const candidateInput of input.task.candidates) {
    const candidate = DecisionTaskCandidate.create(candidateInput)
    if (candidate instanceof InvalidSystemWorkflowError) return candidate
    candidates.push(candidate)
  }
  const excludedAccountIds = [
    ...new Set([input.createdByAccountId, ...input.task.excludedAccountIds]),
  ]
  const task = DecisionTask.create({
    caseId: input.caseId,
    key: input.task.key,
    round: input.round ?? 1,
    candidateAccountIds: candidates.map((candidate) => candidate.accountId),
    excludedAccountIds,
    requiredApprovals: input.task.requiredApprovals,
    proposalDigest: input.proposalDigest,
    openedAt: input.task.openedAt,
    dueAt: input.task.dueAt,
  })
  if (task instanceof InvalidSystemWorkflowError) return task

  return {
    task,
    candidates,
    exclusions: excludedAccountIds.map((accountId) => ({
      accountId,
      reason: accountId === input.createdByAccountId ? "creator" : "policy",
    })),
  }
}
