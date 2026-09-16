import { z } from "zod"
import { PreparePerformanceReviewRetirementCurrentStateAdapter } from "@/contexts/performance-review/infrastructure/adapters/prepare-performance-review-retirement-current-state.adapter"
import { RevalidateCompanyProcedureExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-execution.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import { RecordSourceRetirementEntity } from "@system/domain/entities/record-source-retirement.entity"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { RecordSourceRetirementRepository } from "@system/infrastructure/repositories/records/record-source-retirement.repository"
import {
  PerformanceReviewRetirementConflictError,
  PerformanceReviewRetirementForbiddenError,
} from "@/contexts/performance-review/application/errors"

const commandSchema = z.strictObject({
  planId: z.uuid(),
  planDigest: z.string().regex(/^[0-9a-f]{64}$/),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  number: z.number().int().positive().safe(),
  proposalVersion: z.number().int().positive().safe(),
  proposalDigest: z.string().regex(/^[0-9a-f]{64}$/),
})
type Context = ConstructorParameters<
  typeof PreparePerformanceReviewRetirementCurrentStateAdapter
>[0]

/** 現在の全件保全と人の承認資格を再検査し、原記録を消さずに停止世代の撤去を確定する。 */
export class ExecutePerformanceReviewRetirementAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown, stepUpToken: string) {
    const parsed = commandSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const command = parsed.data
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined)
      return new PerformanceReviewRetirementForbiddenError("retirement authentication required")
    const current = await new PreparePerformanceReviewRetirementCurrentStateAdapter(this.c).prepare(
      {
        planId: command.planId,
        planDigest: command.planDigest,
        sourceNamespace: command.sourceNamespace,
      },
      stepUpToken,
    )
    if (current instanceof Error) return current
    const proposal = await new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.retire"],
    }).findByNumber(command.number)
    if (proposal instanceof Error) return proposal
    if (
      proposal === null ||
      proposal.version !== command.proposalVersion ||
      proposal.digest !== command.proposalDigest
    )
      return new PerformanceReviewRetirementConflictError("retirement proposal version differs")
    const value = await RecordRetirementProposalValue.restore(JSON.parse(proposal.bodyJson))
    if (value instanceof Error) return value
    if (
      proposal.createdByAccountId !== authentication.accountId ||
      value.props.actorAccountId !== authentication.accountId
    )
      return new PerformanceReviewRetirementForbiddenError("retirement applicant differs")
    if (
      value.props.digest.toString() !== proposal.digest ||
      value.props.plan.snapshot.id !== current.plan.snapshot.id ||
      value.props.plan.digest !== current.plan.digest ||
      value.props.terminalReceipt.snapshot.id !== current.terminalReceiptId ||
      value.props.terminalReceipt.digest !== current.terminalReceiptDigest
    )
      return new PerformanceReviewRetirementConflictError("retirement verified scope differs")
    const repository = new RecordSourceRetirementRepository({
      env: this.c.env,
      assertions: current.assertions,
    })
    const replay = async () => {
      const saved = await repository.findByFreeze(current.plan.snapshot.freezeId)
      if (saved instanceof Error || saved === null) return saved
      const snapshot = saved.snapshot
      if (
        snapshot.proposalId !== proposal.proposalId ||
        snapshot.proposalVersion !== proposal.version ||
        snapshot.proposalDigest !== proposal.digest ||
        snapshot.caseId !== proposal.caseId ||
        snapshot.actorAccountId !== authentication.accountId ||
        snapshot.planId !== command.planId ||
        snapshot.planDigest !== command.planDigest ||
        snapshot.terminalReceiptDigest !== current.terminalReceiptDigest
      )
        return new PerformanceReviewRetirementConflictError(
          "retirement was finalized under another proposal",
        )
      return { retirement_id: snapshot.id, finalized_at: snapshot.finalizedAt }
    }
    const existing = await replay()
    if (existing instanceof Error) return existing
    if (existing !== null) return existing
    if (proposal.status !== "approved")
      return new PerformanceReviewRetirementConflictError("retirement is not approved")
    const at = this.c.var.now()
    const qualification = await new RevalidateCompanyProcedureExecutionAdapter(
      this.c,
    ).prepareApprovedEvidence({
      applicationId: proposal.number,
      expectedCaseId: proposal.caseId,
      expectedSeriesId: proposal.seriesId,
      expectedProposalDigest: proposal.digest,
      expectedPayload: JSON.parse(value.props.canonical.toString()),
      completionOperationKey: "system.record.retire",
      subjectEmployeeId: null,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set(),
      executorAccountId: authentication.accountId,
      executedAt: at,
    })
    if (qualification instanceof Error) return qualification
    const authorization = ExecutionAuthorizationEntity.create({
      id: `record-retirement:${proposal.caseId}`,
      caseId: proposal.caseId,
      operationKey: "system.record.retire",
      proposalDigest: proposal.digest,
      grantedToAccountId: authentication.accountId,
      grantedAt: at,
      expiresAt: new Date(at.getTime() + 60_000),
      usedAt: null,
    })
    if (authorization instanceof Error) return authorization
    const retirement = RecordSourceRetirementEntity.create({
      id: crypto.randomUUID(),
      proposal: value,
      proposalId: proposal.proposalId,
      proposalVersion: proposal.version,
      authorization,
      at,
      auditEventId: crypto.randomUUID(),
    })
    if (retirement instanceof Error) return retirement
    const finalized = await repository.finalize({
      retirement,
      authorization,
      executionGuards: qualification,
    })
    if (finalized instanceof Error) {
      const raced = await replay()
      if (raced !== null && !(raced instanceof Error)) return raced
      return new PerformanceReviewRetirementConflictError(
        "retirement changed before finalization",
        {
          cause: finalized,
        },
      )
    }
    return { retirement_id: retirement.snapshot.id, finalized_at: retirement.snapshot.finalizedAt }
  }
}
