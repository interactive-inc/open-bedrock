import type { ApplicationWorkflowStep } from "@/contexts/company/domain/organization/company-procedure-workflow"
import type {
  WorkflowApproverMatch,
  WorkflowApproverProvenance,
} from "@/contexts/company/domain/organization/company-procedure-approver"
import type {
  WorkflowStepCandidateSnapshot,
  WorkflowStepSnapshotDraft,
} from "@/contexts/company/domain/organization/company-procedure-step-snapshot"
import type { Context } from "@/env"
import { dueAt } from "@/contexts/company/domain/organization/company-procedure-due-at"
import { resolveWorkflowApproverMatches } from "@/contexts/company/domain/organization/resolve-company-procedure-approver-matches"
import { UnresolvableWorkflowStepError } from "@/contexts/company/domain/organization/unresolvable-company-procedure-task.error"

export async function resolveWorkflowStepSnapshot(props: {
  c: Context
  applicantEmployeeId: number | null
  step: ApplicationWorkflowStep
  activatedAt: string
  resolvedAt?: string
  resolutionReason?: "activation" | "legacy_backfill"
  excludedEmployeeIds?: ReadonlySet<number>
  targetDepartmentCode?: string | null
}): Promise<WorkflowStepSnapshotDraft | Error> {
  const stepDueAt = dueAt(props.activatedAt, props.step.due_days)
  const resolvedAt = props.resolvedAt ?? props.activatedAt
  const escalationOffset = props.step.approvers.length
  const includesEscalation = stepDueAt !== null && props.step.escalation_approvers.length > 0
  const matches = await resolveWorkflowApproverMatches({
    c: props.c,
    applicantEmployeeId: props.applicantEmployeeId,
    selectors: includesEscalation
      ? [...props.step.approvers, ...props.step.escalation_approvers]
      : props.step.approvers,
    resolvedAt,
    targetDepartmentCode: props.targetDepartmentCode,
  })

  if (matches instanceof Error) return matches
  const primaryMatches = matches.filter(
    (match) => match.provenance.selector_index < escalationOffset,
  )
  const escalationMatches = matches
    .filter((match) => match.provenance.selector_index >= escalationOffset)
    .map((match) => ({
      ...match,
      provenance: {
        ...match.provenance,
        selector_index: match.provenance.selector_index - escalationOffset,
      },
    }))

  const primaryCandidates = candidateRows({
    matches: primaryMatches,
    source: "primary",
    eligibleFrom: null,
    resolvedAt,
  }).filter((candidate) => props.excludedEmployeeIds?.has(candidate.employeeId) !== true)
  const primaryEmployeeIds = [
    ...new Set(primaryCandidates.map((candidate) => candidate.employeeId)),
  ]
  const requiredApprovals = requiredApprovalsForStep(props.step, primaryEmployeeIds.length)

  if (primaryEmployeeIds.length === 0 || requiredApprovals > primaryEmployeeIds.length) {
    return new UnresolvableWorkflowStepError(props.step.key)
  }

  const candidates = [
    ...primaryCandidates,
    ...candidateRows({
      matches: escalationMatches,
      source: "escalation",
      eligibleFrom: stepDueAt,
      resolvedAt,
    }).filter((candidate) => props.excludedEmployeeIds?.has(candidate.employeeId) !== true),
  ]

  return {
    requiredApprovals,
    activatedAt: props.activatedAt,
    dueAt: stepDueAt,
    escalatedAt: null,
    resolutionReason: props.resolutionReason ?? "activation",
    resolutionId: crypto.randomUUID(),
    candidates,
  }
}

function requiredApprovalsForStep(step: ApplicationWorkflowStep, candidateCount: number): number {
  if (step.approval_mode === "all") return candidateCount
  if (step.approval_mode === "minimum") return step.minimum_approvals ?? 1
  return 1
}

function candidateRows(props: {
  matches: ReadonlyArray<WorkflowApproverMatch>
  source: "primary" | "escalation"
  eligibleFrom: string | null
  resolvedAt: string
}): ReadonlyArray<WorkflowStepCandidateSnapshot> {
  const candidatesByEmployee = new Map<
    number,
    Map<WorkflowApproverMatch["accountId"], Array<WorkflowApproverProvenance>>
  >()

  for (const match of props.matches) {
    const candidatesByAccount = candidatesByEmployee.get(match.employeeId) ?? new Map()
    const provenance = candidatesByAccount.get(match.accountId) ?? []
    provenance.push(match.provenance)
    candidatesByAccount.set(match.accountId, provenance)
    candidatesByEmployee.set(match.employeeId, candidatesByAccount)
  }

  return [...candidatesByEmployee.entries()].flatMap(([employeeId, candidatesByAccount]) =>
    [...candidatesByAccount.entries()].map(([accountId, provenance]) => ({
      employeeId,
      accountId,
      source: props.source,
      selectorsJson: JSON.stringify(provenance),
      eligibleFrom: props.eligibleFrom,
      resolvedAt: props.resolvedAt,
    })),
  )
}
