export type WorkflowStepCandidateSnapshot = Readonly<{
  employeeId: number
  accountId: number
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
  resolutionReason: "activation" | "legacy_backfill" | "manual_repair"
  resolutionId: string
  candidates: ReadonlyArray<WorkflowStepCandidateSnapshot>
}>
