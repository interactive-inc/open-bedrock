import type { AccountId } from "@system/domain/auth/account-id"
import type {
  SystemTaskPersistence,
  SystemWorkflowWriter,
} from "@system/application/workflow/system-workflow-writer"
import { DecisionTaskCandidate } from "@system/domain/workflow/decision-task-candidate.entity"
import { DecisionTask } from "@system/domain/workflow/decision-task.entity"
import { InvalidSystemProposalError } from "@system/domain/workflow/invalid-system-proposal.error"
import { InvalidSystemWorkflowError } from "@system/domain/workflow/invalid-system-workflow.error"
import { Proposal } from "@system/domain/workflow/proposal.entity"
import type { ProposalDigest } from "@system/domain/workflow/system-case-reference"
import type { SystemCaseReference } from "@system/domain/workflow/system-case-reference"
import { SystemCase } from "@system/domain/workflow/system-case.entity"

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

export type StartSystemProcedureCommand = Readonly<{
  seriesId: string
  version: number
  procedureKey: string
  procedureRevision: number
  body: unknown
  createdByAccountId: AccountId
  supersedesProposalId: string | null
  createdAt: Date
  firstTask: StartSystemProcedureTask
  subject?: SystemCaseReference
}>

export type StartedSystemProcedure = Readonly<{
  number: number
  proposal: Proposal
  workflowCase: SystemCase
}>

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

/** 提案、Case、最初の判断Taskを検証後に一つのSystem transactionで開始する。 */
export class StartSystemProcedure {
  constructor(private readonly writer: SystemWorkflowWriter) {}

  async run(
    command: StartSystemProcedureCommand,
  ): Promise<
    StartedSystemProcedure | InvalidSystemProposalError | InvalidSystemWorkflowError | Error
  > {
    const proposalId = crypto.randomUUID()
    const workflowCaseId = crypto.randomUUID()
    const proposal = await Proposal.create({
      id: proposalId,
      seriesId: command.seriesId,
      version: command.version,
      procedureKey: command.procedureKey,
      procedureRevision: command.procedureRevision,
      body: command.body,
      createdByAccountId: command.createdByAccountId,
      supersedesProposalId: command.supersedesProposalId,
      createdAt: command.createdAt,
    })

    if (proposal instanceof InvalidSystemProposalError) return proposal

    const workflowCase = SystemCase.create({
      id: workflowCaseId,
      subject: command.subject ?? {
        context: "system",
        kind: "proposal",
        id: proposal.seriesId,
        version: String(proposal.version),
      },
      proposalDigest: proposal.digest,
      createdByAccountId: proposal.createdByAccountId,
      status: "pending",
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    })

    if (workflowCase instanceof InvalidSystemWorkflowError) return workflowCase

    const firstTask = createSystemTaskPersistence({
      task: command.firstTask,
      caseId: workflowCase.id,
      createdByAccountId: workflowCase.createdByAccountId,
      proposalDigest: proposal.digest,
    })
    if (firstTask instanceof InvalidSystemWorkflowError) return firstTask
    if (firstTask.task.openedAt.getTime() < command.createdAt.getTime()) {
      return new InvalidSystemWorkflowError("invalid_chronology")
    }
    const persisted = await this.writer.start({
      proposal,
      workflowCase,
      firstTask,
    })

    return persisted instanceof Error ? persisted : { number: persisted, proposal, workflowCase }
  }
}
