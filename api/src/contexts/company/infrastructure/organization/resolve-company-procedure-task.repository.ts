import { applicableWorkflowSteps } from "@/contexts/company/domain/policies/company-procedure-applicable-steps.policy"
import { resolveWorkflowStepSnapshot } from "@/contexts/company/infrastructure/organization/resolve-company-procedure-task-snapshot.repository"
import type { CompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import type { CompanyContext } from "@/contexts/company/infrastructure/configuration/company-context.repository"
import type { StartSystemProcedureTask } from "@system/domain/policies/decision-task.policy"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

export type CompanyProcedureApplicant = Readonly<{
  id: number
  code: string | null
  dept_id: number | null
  dept_name: string | null
  position: string | null
  status: string
}>

export type ResolvedCompanyProcedureTask = Readonly<{
  key: string
  name: string
  rejectionBehavior: "reject" | "return"
  allowDelegation: boolean
  task: StartSystemProcedureTask
}>

/** Company policyを評価し、Systemへ渡せるAccount候補とopaque資格証拠だけを返す。 */
export async function resolveCompanyProcedureTask(
  input: Readonly<{
    c: CompanyContext
    policy: CompanyProcedureDecisionPolicy
    payload: unknown
    applicant: CompanyProcedureApplicant
    activatedAt: Date
    afterTaskKey: string | null
    authoritySubjectEmployeeId?: number | null
    targetDepartmentCode?: string | null
    excludedEmployeeIds?: ReadonlySet<number>
  }>,
): Promise<ResolvedCompanyProcedureTask | null | Error> {
  if (input.policy.workflow === null) {
    return new Error("Company procedure requires an explicit authority workflow")
  }

  const steps = applicableWorkflowSteps({
    workflow: input.policy.workflow,
    payload: input.payload,
    applicant: input.applicant,
  })
  const previousIndex =
    input.afterTaskKey === null ? null : steps.findIndex((step) => step.key === input.afterTaskKey)
  if (previousIndex === -1) return new Error("current Company procedure task is unknown")
  const index = previousIndex === null ? 0 : previousIndex + 1
  if (index >= steps.length) return null
  const step = steps[index]
  if (step === undefined) return null

  return resolveConfiguredTask(input, step)
}

async function resolveConfiguredTask(
  input: Parameters<typeof resolveCompanyProcedureTask>[0],
  step: ApplicationWorkflowStep,
): Promise<ResolvedCompanyProcedureTask | Error> {
  const activatedAt = input.activatedAt.toISOString()
  const snapshot = await resolveWorkflowStepSnapshot({
    c: input.c,
    applicantEmployeeId:
      input.authoritySubjectEmployeeId === undefined
        ? input.applicant.id
        : input.authoritySubjectEmployeeId,
    step,
    activatedAt,
    excludedEmployeeIds: input.excludedEmployeeIds,
    targetDepartmentCode: input.targetDepartmentCode ?? null,
  })
  if (snapshot instanceof Error) return snapshot
  const candidates: StartSystemProcedureTask["candidates"][number][] = []
  for (const candidate of snapshot.candidates) {
    const evidence = CanonicalSystemJsonValue.create(JSON.parse(candidate.selectorsJson))
    if (evidence instanceof Error) return evidence
    const digest = await ProposalDigestValue.create(evidence)
    if (digest instanceof Error) return digest
    candidates.push({
      accountId: candidate.accountId,
      source: candidate.source,
      evidenceContext: "company",
      evidenceKind: "organizational-authority",
      evidenceId: snapshot.resolutionId,
      evidenceVersion: candidate.resolvedAt,
      eligibilityDigest: digest.toString(),
      eligibleFrom: candidate.eligibleFrom === null ? null : new Date(candidate.eligibleFrom),
      resolvedAt: new Date(candidate.resolvedAt),
    })
  }

  return {
    key: step.key,
    name: step.name,
    rejectionBehavior: step.rejection_behavior,
    allowDelegation: step.allow_delegation,
    task: {
      key: step.key,
      requiredApprovals: snapshot.requiredApprovals,
      openedAt: new Date(snapshot.activatedAt),
      dueAt: snapshot.dueAt === null ? null : new Date(snapshot.dueAt),
      candidates,
      excludedAccountIds: [],
    },
  }
}
