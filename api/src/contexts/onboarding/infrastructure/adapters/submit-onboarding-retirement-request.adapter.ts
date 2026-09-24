import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { onboardingRetirementSubmissionCommandSchema } from "@/contexts/onboarding/domain/schemas/onboarding-retirement-submission-command.schema"
import { PrepareOnboardingRetirementCurrentStateAdapter } from "@/contexts/onboarding/infrastructure/adapters/prepare-onboarding-retirement-current-state.adapter"
import { openSystemRecordRetirementVerificationReceipts } from "@system/interface/operations/open-system-record-retirement-verification-receipts"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import {
  OnboardingRetirementConflictError,
  OnboardingRetirementForbiddenError,
} from "@/contexts/onboarding/application/errors"

type Context = ConstructorParameters<typeof PrepareOnboardingRetirementCurrentStateAdapter>[0]

/** 全件検査の計画と終端を固定し、会社資格で解決した人の判断待ち案件を作成する。 */
export class SubmitOnboardingRetirementRequestAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, stepUpToken: string) {
    const parsed = onboardingRetirementSubmissionCommandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new OnboardingRetirementForbiddenError("retirement authentication required")
    const current = await new PrepareOnboardingRetirementCurrentStateAdapter(this.c).prepare(
      {
        planId: command.planId,
        planDigest: command.planDigest,
        sourceNamespace: command.sourceNamespace,
      },
      stepUpToken,
    )
    if (current instanceof Error) return current
    const receipt = await openSystemRecordRetirementVerificationReceipts({
      env: this.c.env,
      assertions: current.assertions,
    }).find(current.terminalReceiptId)
    if (receipt instanceof Error) return receipt
    if (receipt === null || receipt.digest !== current.terminalReceiptDigest)
      return new OnboardingRetirementConflictError("retirement terminal receipt differs")
    const proposal = await RecordRetirementProposalValue.create({
      plan: current.plan,
      terminalReceipt: receipt,
      actorAccountId: authentication.accountId,
      reason: command.reason,
    })
    if (proposal instanceof Error) return proposal
    const query = new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.retire"],
    })
    const resolveRevision = async () => {
      if (command.revision.mode === "create") {
        const identity = CanonicalSystemJsonValue.create({
          operation: "onboarding.record-retirement.request",
          actorAccountId: authentication.accountId,
          id: command.revision.id,
        })
        if (identity instanceof Error) return identity
        const digest = await ProposalDigestValue.create(identity)
        if (digest instanceof Error) return digest
        return {
          seriesId: `record-retirement:${digest.toString()}`,
          version: 1,
          supersedesProposalId: null,
        }
      }
      const previous = await query.findByNumber(
        command.revision.number,
        command.revision.previousVersion,
      )
      if (previous instanceof Error) return previous
      if (previous === null)
        return new OnboardingRetirementConflictError("retirement previous version is missing")
      if (previous.createdByAccountId !== authentication.accountId)
        return new OnboardingRetirementForbiddenError("retirement applicant differs")
      if (
        previous.digest !== command.revision.previousDigest ||
        !["cancelled", "rejected", "returned"].includes(previous.status) ||
        !Number.isSafeInteger(previous.version + 1)
      )
        return new OnboardingRetirementConflictError(
          "retirement previous version is not resubmittable",
        )
      const original = await RecordRetirementProposalValue.restore(JSON.parse(previous.bodyJson))
      if (original instanceof Error) return original
      if (
        original.props.plan.snapshot.id !== current.plan.snapshot.id ||
        original.props.plan.digest !== current.plan.digest
      )
        return new OnboardingRetirementConflictError(
          "retirement resubmission cannot replace the verified plan",
        )
      return {
        seriesId: previous.seriesId,
        version: previous.version + 1,
        supersedesProposalId: previous.proposalId,
      }
    }
    const revision = await resolveRevision()
    if (revision instanceof Error) return revision
    const replay = async () => {
      const existing = await query.findBySeriesVersion({
        seriesId: revision.seriesId,
        version: revision.version,
        creatorAccountId: authentication.accountId,
      })
      if (existing instanceof Error || existing === null) return existing
      if (
        existing.supersedesProposalId !== revision.supersedesProposalId ||
        existing.procedureKey !== command.procedureKey ||
        existing.digest !== proposal.props.digest.toString() ||
        existing.bodyJson !== proposal.props.canonical.toString()
      )
        return new OnboardingRetirementConflictError("retirement submission replay differs")
      const rechecked = await new PrepareOnboardingRetirementCurrentStateAdapter(this.c).prepare(
        {
          planId: command.planId,
          planDigest: command.planDigest,
          sourceNamespace: command.sourceNamespace,
        },
        stepUpToken,
      )
      if (rechecked instanceof Error) return rechecked
      return {
        number: existing.number,
        caseId: existing.caseId,
        planId: command.planId,
        proposalDigest: existing.digest,
        status: existing.status,
      }
    }
    const existing = await replay()
    if (existing instanceof Error) return existing
    if (existing !== null) return { created: false, request: existing }
    const at = this.c.var.now()
    const task = await prepareCompanyRecordProcedureTask(this.c, {
      procedureKey: command.procedureKey,
      proposal,
      applicantAccountId: authentication.accountId,
      at,
    })
    if (task instanceof Error) return task
    if (task.resolved.guards.length === 0)
      return new OnboardingRetirementForbiddenError("retirement decision qualification required")
    const started = await new StartSystemProcedure({
      writer: new SystemD1WorkflowAdapter({
        env: this.c.env,
        startGuards: [...current.assertions, ...task.resolved.guards],
      }),
    }).run({
      seriesId: revision.seriesId,
      version: revision.version,
      procedureKey: task.definition.key,
      procedureRevision: task.definition.revision,
      body: JSON.parse(proposal.props.canonical.toString()),
      createdByAccountId: authentication.accountId,
      supersedesProposalId: revision.supersedesProposalId,
      createdAt: at,
      firstTask: task.resolved.task,
    })
    if (started instanceof Error) {
      const raced = await replay()
      if (raced instanceof Error) return raced
      if (raced !== null) return { created: false, request: raced }
      return new OnboardingRetirementConflictError(
        "retirement submission changed before persistence",
        {
          cause: started,
        },
      )
    }
    return {
      created: true,
      request: {
        number: started.number,
        caseId: started.workflowCase.id,
        planId: current.plan.snapshot.id,
        proposalDigest: started.proposal.digest,
        status: "pending",
      },
    }
  }
}
