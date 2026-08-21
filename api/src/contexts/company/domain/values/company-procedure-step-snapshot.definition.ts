import type { AccountId } from "@system/domain/values/account-id.schema"

export type WorkflowStepCandidateSnapshot = Readonly<{
  employeeId: number
  accountId: AccountId
  source: "primary" | "escalation"
  selectorsJson: string
  eligibleFrom: string | null
  resolvedAt: string
}>

export type WorkflowStepSnapshotDraft = Readonly<{
  requiredApprovals: number
  activatedAt: string
  dueAt: string | null
  escalatedAt: string | null
  resolutionReason: "activation" | "initialization" | "manual_repair"
  resolutionId: string
  candidates: ReadonlyArray<WorkflowStepCandidateSnapshot>
}>
