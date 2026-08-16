import type { AccountId } from "@system/domain/auth/account-id"
import type { ProposalDigest } from "@system/domain/workflow/system-case-reference"

export type SystemProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "returned"
  | "cancelled"
  | "executed"

export type SystemProposalView = Readonly<{
  number: number
  proposalId: string
  seriesId: string
  version: number
  procedureKey: string
  procedureRevision: number
  procedureNumber: number
  title: string
  category: string
  description: string | null
  inputSchemaJson: string
  decisionPolicyJson: string
  completionOperationKey: string | null
  bodyJson: string
  digest: ProposalDigest
  createdByAccountId: AccountId
  createdAt: Date
  caseId: string
  status: SystemProposalStatus
  updatedAt: Date
  currentTaskKey: string | null
  currentTaskRound: number | null
  currentTaskOpenedAt: Date | null
  currentTaskDueAt: Date | null
  lastTaskKey: string
  lastTaskRound: number
  lastTaskOutcome: "pending" | "approved" | "rejected" | "returned" | "cancelled"
}>

export type SystemAttestationView = Readonly<{
  id: string
  taskKey: string
  round: number
  actorAccountId: AccountId
  representedAccountId: AccountId
  delegationId: string | null
  action: "approve" | "reject" | "return"
  comment: string | null
  decidedAt: Date
}>

export type SystemProposalList = Readonly<{
  proposals: ReadonlyArray<SystemProposalView>
  total: number
}>

export type SystemDecisionTaskView = Readonly<{
  key: string
  round: number
  requiredApprovals: number
  openedAt: Date
  dueAt: Date | null
  outcome: "pending" | "approved" | "rejected" | "returned" | "cancelled"
  closedAt: Date | null
}>

export type SystemProposalQuery = Readonly<{
  findByNumber(number: number): Promise<SystemProposalView | null | Error>
  list(
    input: Readonly<{
      creatorAccountIds: ReadonlyArray<AccountId> | null
      actorAccountId: AccountId | null
      statuses: ReadonlyArray<SystemProposalStatus> | null
      procedureKey: string | null
      createdFrom: Date | null
      createdTo: Date | null
      includeCancelled: boolean
      sort: "created_at_asc" | "created_at_desc"
      limit: number
      offset: number
      at: Date
    }>,
  ): Promise<SystemProposalList | Error>
  listAttestations(caseId: string): Promise<ReadonlyArray<SystemAttestationView> | Error>
  listTasks(caseId: string): Promise<ReadonlyArray<SystemDecisionTaskView> | Error>
  listTaskCandidateAccountIds(
    input: Readonly<{
      caseId: string
      taskKey: string
      round: number
      at: Date
    }>,
  ): Promise<ReadonlyArray<AccountId> | Error>
  findDelegation(
    input: Readonly<{
      caseId: string
      actorAccountId: AccountId
      candidateAccountIds: ReadonlyArray<AccountId>
      at: Date
    }>,
  ): Promise<Readonly<{ id: string; representedAccountId: AccountId }> | null | Error>
}>
