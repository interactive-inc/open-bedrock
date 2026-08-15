import type { ApplicationWorkflowStep } from "@/contexts/request/domain/application-workflow"
import type {
  WorkflowApproverMatch,
  WorkflowApproverProvenance,
} from "@/contexts/request/domain/workflow-approver"
import type {
  WorkflowStepCandidateSnapshot,
  WorkflowStepSnapshotDraft,
} from "@/contexts/request/domain/workflow-step-snapshot"
import type { Context } from "@/env"
import { accountEmployeeLinks } from "@/contexts/company/infrastructure/schema/employee"
import { accounts } from "@/contexts/company/infrastructure/schema/compatibility/account-schema"
import { eq } from "drizzle-orm"
import { dueAt } from "@/contexts/request/application/workflow/due-at"
import { filterLiveWorkflowAccounts } from "@/contexts/request/application/workflow/filter-live-workflow-accounts"
import { resolveWorkflowApproverMatches } from "@/contexts/request/application/workflow/resolve-workflow-approver-matches"
import { UnresolvableWorkflowStepError } from "@/contexts/request/application/workflow/unresolvable-workflow-step-error"

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
  const primaryMatches = await resolveWorkflowApproverMatches({
    c: props.c,
    applicantEmployeeId: props.applicantEmployeeId,
    selectors: props.step.approvers,
    targetDepartmentCode: props.targetDepartmentCode,
  })

  if (primaryMatches instanceof Error) return primaryMatches

  const escalationMatches =
    stepDueAt === null || props.step.escalation_approvers.length === 0
      ? []
      : await resolveWorkflowApproverMatches({
          c: props.c,
          applicantEmployeeId: props.applicantEmployeeId,
          selectors: props.step.escalation_approvers,
          targetDepartmentCode: props.targetDepartmentCode,
        })

  if (escalationMatches instanceof Error) return escalationMatches

  try {
    const accountRows = await props.c.var.database
      .select({ id: accounts.id, employeeId: accountEmployeeLinks.employeeId })
      .from(accounts)
      .innerJoin(accountEmployeeLinks, eq(accountEmployeeLinks.accountId, accounts.id))
      .where(eq(accounts.status, "active"))

    const liveAccounts = await filterLiveWorkflowAccounts(
      props.c,
      accountRows.flatMap((account) =>
        account.employeeId === null
          ? []
          : [{ employeeId: account.employeeId, accountId: account.id }],
      ),
    )
    if (liveAccounts instanceof Error) return liveAccounts

    const activeAccountsByEmployee = new Map<number, Array<number>>()

    for (const account of liveAccounts) {
      const accountIds = activeAccountsByEmployee.get(account.employeeId) ?? []
      accountIds.push(account.accountId)
      activeAccountsByEmployee.set(account.employeeId, accountIds)
    }

    const primaryCandidates = candidateRows({
      matches: primaryMatches,
      accountsByEmployee: activeAccountsByEmployee,
      source: "primary",
      eligibleFrom: null,
      resolvedAt: props.resolvedAt ?? props.activatedAt,
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
        accountsByEmployee: activeAccountsByEmployee,
        source: "escalation",
        eligibleFrom: stepDueAt,
        resolvedAt: props.resolvedAt ?? props.activatedAt,
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
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to resolve active approver accounts")
  }
}

function requiredApprovalsForStep(step: ApplicationWorkflowStep, candidateCount: number): number {
  if (step.approval_mode === "all") return candidateCount
  if (step.approval_mode === "minimum") return step.minimum_approvals ?? 1
  return 1
}

function candidateRows(props: {
  matches: ReadonlyArray<WorkflowApproverMatch>
  accountsByEmployee: ReadonlyMap<number, ReadonlyArray<number>>
  source: "primary" | "escalation"
  eligibleFrom: string | null
  resolvedAt: string
}): ReadonlyArray<WorkflowStepCandidateSnapshot> {
  const provenanceByCandidate = new Map<string, Array<WorkflowApproverProvenance>>()

  for (const match of props.matches) {
    const activeAccountIds = props.accountsByEmployee.get(match.employeeId) ?? []
    const eligibleAccountIds =
      match.accountId === null
        ? activeAccountIds
        : activeAccountIds.includes(match.accountId)
          ? [match.accountId]
          : []

    for (const accountId of eligibleAccountIds) {
      const key = `${match.employeeId}:${accountId}`
      const provenance = provenanceByCandidate.get(key) ?? []
      provenance.push(match.provenance)
      provenanceByCandidate.set(key, provenance)
    }
  }

  return [...provenanceByCandidate.entries()].map(([key, provenance]) => {
    const separator = key.indexOf(":")
    return {
      employeeId: Number(key.slice(0, separator)),
      accountId: Number(key.slice(separator + 1)),
      source: props.source,
      selectorsJson: JSON.stringify(provenance),
      eligibleFrom: props.eligibleFrom,
      resolvedAt: props.resolvedAt,
    }
  })
}
