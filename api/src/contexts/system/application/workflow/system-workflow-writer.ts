import type { DecisionTaskCandidate } from "@system/domain/workflow/decision-task-candidate.entity"
import type { DecisionTask } from "@system/domain/workflow/decision-task.entity"
import type { HumanAttestation } from "@system/domain/workflow/human-attestation.entity"
import type { Proposal } from "@system/domain/workflow/proposal.entity"
import type { SystemCase } from "@system/domain/workflow/system-case.entity"
import type { AccountId } from "@system/domain/auth/account-id"

export type SystemTaskExclusion = Readonly<{
  accountId: AccountId
  reason: "creator" | "subject" | "policy"
}>

export type SystemTaskPersistence = Readonly<{
  task: DecisionTask
  candidates: ReadonlyArray<DecisionTaskCandidate>
  exclusions: ReadonlyArray<SystemTaskExclusion>
}>

export type SystemWorkflowDecisionPersistence = Readonly<{
  attestation: HumanAttestation
  decidedAt: Date
  nextTask: SystemTaskPersistence | null
}>

export type SystemWorkflowDecisionResult = Readonly<{
  caseStatus: "pending" | "approved" | "rejected" | "returned"
  taskOutcome: "pending" | "approved" | "rejected" | "returned"
}>

export type SystemWorkflowWriter = Readonly<{
  start(
    input: Readonly<{
      proposal: Proposal
      workflowCase: SystemCase
      firstTask: SystemTaskPersistence
    }>,
  ): Promise<number | Error>
  decide(input: SystemWorkflowDecisionPersistence): Promise<SystemWorkflowDecisionResult | Error>
  cancel(
    input: Readonly<{
      number: number
      createdByAccountId: AccountId
      cancelledAt: Date
    }>,
  ): Promise<true | "not_found" | "not_pending" | Error>
  reassign(
    input: Readonly<{
      caseId: string
      taskKey: string
      round: number
      reassignedAt: Date
      replacement: SystemTaskPersistence
    }>,
  ): Promise<true | "not_pending" | Error>
}>
