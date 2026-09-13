import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import {
  SoftwareLicenseConflictError,
  SoftwareLicenseForbiddenError,
  SoftwareLicenseNotFoundError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyConflictError } from "@/contexts/company/domain/errors"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { recordPreservationIntentSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { RejectSystemTask } from "@system/application/workflow/reject-system-task"
import { ReturnSystemTask } from "@system/application/workflow/return-system-task"

/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createLicensePreservationDecisionHandlers(action: "approve" | "reject") {
  return softwareLicenseFactory.createHandlers(
    ensureLicenseEnabled,
    zValidator("param", z.strictObject({ id: licenseIdSchema, number: licenseIdSchema })),
    zValidator(
      "json",
      z.strictObject({
        decision_target: z.strictObject({
          proposal_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
          task_key: z.string().min(1).max(100),
          task_round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        }),
        comment: z.string().max(3000).nullable(),
      }),
    ),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined || authentication.machineCredentialId !== null)
        throw new SoftwareLicenseForbiddenError()
      const at = c.var.now()
      const proof = await new PrepareSystemReadAuthorizationAdapter(c).prepare(authentication, at)
      if (proof instanceof Error) throw new SoftwareLicenseUnavailableError()
      if (proof === null) throw new SoftwareLicenseForbiddenError()
      const technical = proof.assertions(at)
      if (technical instanceof Error) throw new SoftwareLicenseForbiddenError()
      const query = new SystemD1ProposalAdapter({
        env: c.env,
        visibleCompletionOperationKeys: ["system.record.preserve"],
      })
      const proposal = await query.findByNumber(c.req.valid("param").number)
      if (proposal instanceof Error) throw new SoftwareLicenseUnavailableError()
      if (proposal === null) throw new SoftwareLicenseNotFoundError()
      const intent = recordPreservationIntentSchema.safeParse(JSON.parse(proposal.bodyJson))
      if (!intent.success) throw new SoftwareLicenseUnavailableError()
      const source = PreservedRecordSourceValue.create(intent.data.source)
      if (source instanceof Error) throw new SoftwareLicenseUnavailableError()
      if (
        source.props.ownerContext !== "software-license" ||
        source.props.recordKind !== "license-record" ||
        source.props.recordId !== String(c.req.valid("param").id) ||
        source.props.sourceNamespace !== c.env.RECORD_SOURCE_NAMESPACE
      )
        throw new SoftwareLicenseNotFoundError()
      const body = c.req.valid("json")
      const target = body.decision_target
      if (
        proposal.version !== target.proposal_version ||
        proposal.digest !== target.proposal_digest
      )
        throw new SoftwareLicenseConflictError()
      if (
        proposal.status === "pending" ||
        (action === "approve" &&
          (proposal.status === "approved" || proposal.status === "executed")) ||
        (action === "reject" && (proposal.status === "rejected" || proposal.status === "returned"))
      ) {
        const attestations = await query.listAttestations(proposal.caseId)
        if (attestations instanceof Error) throw new SoftwareLicenseUnavailableError()
        const original = attestations.find(
          (attestation) =>
            attestation.actorAccountId === authentication.accountId &&
            attestation.taskKey === target.task_key &&
            attestation.round === target.task_round &&
            (attestation.action === action ||
              (action === "reject" && attestation.action === "return")) &&
            attestation.comment === body.comment,
        )
        if (original !== undefined) {
          const guard = await new PrepareSystemCaseReadGuardAdapter(c).prepare({
            caseId: proposal.caseId,
            accountId: authentication.accountId,
            at: c.var.now(),
          })
          if (guard instanceof Error) throw new SoftwareLicenseUnavailableError()
          const current = await query.findByNumber(proposal.number)
          if (
            current === null ||
            current instanceof Error ||
            current.proposalId !== proposal.proposalId ||
            current.status !== proposal.status ||
            current.currentTaskKey !== proposal.currentTaskKey ||
            current.currentTaskRound !== proposal.currentTaskRound
          )
            throw new SoftwareLicenseConflictError()
          const now = c.var.now()
          const assertions = proof.assertions(now)
          if (assertions instanceof Error) throw new SoftwareLicenseForbiddenError()
          try {
            const verified = await c.env.DB.batch([...assertions, guard(now)])
            if (
              verified.length !== assertions.length + 1 ||
              verified.some((result) => !result.success)
            )
              throw new SoftwareLicenseConflictError()
          } catch {
            throw new SoftwareLicenseConflictError()
          }
          return c.json(
            { status: proposal.status === "executed" ? "approved" : proposal.status },
            200,
          )
        }
        if (proposal.status !== "pending") throw new SoftwareLicenseForbiddenError()
      }
      const accountGuard = await new CompanyAuthoritySnapshotGuardAdapter({
        database: c.env.DB,
      }).prepare({
        accountIds: [authentication.accountId],
        employeeCodes: [],
      })
      if (accountGuard instanceof Error) throw new SoftwareLicenseUnavailableError()
      const employees = await new CompanyEmployeeDirectoryReadAdapter({
        env: {
          DB: c.env.DB,
          COMPANY_TIME_ZONE: c.env.COMPANY_TIME_ZONE,
          NOW: at.toISOString(),
        },
      }).findForAccountIds([authentication.accountId])
      if (employees instanceof Error) throw new SoftwareLicenseUnavailableError()
      const employee = employees[0]?.employee
      if (employee === undefined) throw new SoftwareLicenseForbiddenError()
      const decision = await new PrepareCompanyProcedureDecisionAdapter(c).prepare({
        proposal,
        decisionTarget: {
          proposalVersion: target.proposal_version,
          proposalDigest: target.proposal_digest,
          taskKey: target.task_key,
          taskRound: target.task_round,
        },
        actorAccountId: authentication.accountId,
        actorEmployeeId: employee.id,
        subjectEmployeeId: null,
        targetDepartmentCode: null,
        excludedEmployeeIds: new Set(),
        action,
        decidedAt: at,
      })
      if (decision instanceof CompanyConflictError) throw new SoftwareLicenseConflictError()
      if (decision instanceof Error) throw new SoftwareLicenseForbiddenError()
      const writer = new SystemD1WorkflowAdapter({
        env: c.env,
        decisionGuards: [...technical, accountGuard, ...decision.guards],
      })
      const command = { ...decision, comment: body.comment, decidedAt: at }
      const operation = {
        approve: new ApproveSystemTask(writer),
        reject: new RejectSystemTask(writer),
        return: new ReturnSystemTask(writer),
      }[decision.action]
      if (operation === undefined) throw new SoftwareLicenseUnavailableError()
      const approved = await operation.execute(command)
      if (approved instanceof Error) throw new SoftwareLicenseConflictError()
      return c.json({ status: approved.caseStatus }, 200)
    },
  )
}
