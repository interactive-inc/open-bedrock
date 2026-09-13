import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { SoftwareLicenseHTTPException } from "@/contexts/software-license/interface/errors"
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
        throw new SoftwareLicenseHTTPException(403)
      const at = c.var.now()
      const proof = await new PrepareSystemReadAuthorizationAdapter(c).prepare(authentication, at)
      if (proof instanceof Error) throw new SoftwareLicenseHTTPException(503)
      if (proof === null) throw new SoftwareLicenseHTTPException(403)
      const technical = proof.assertions(at)
      if (technical instanceof Error) throw new SoftwareLicenseHTTPException(403)
      const query = new SystemD1ProposalAdapter({
        env: c.env,
        visibleCompletionOperationKeys: ["system.record.preserve"],
      })
      const proposal = await query.findByNumber(c.req.valid("param").number)
      if (proposal instanceof Error) throw new SoftwareLicenseHTTPException(503)
      if (proposal === null) throw new SoftwareLicenseHTTPException(404)
      const intent = recordPreservationIntentSchema.safeParse(JSON.parse(proposal.bodyJson))
      if (!intent.success) throw new SoftwareLicenseHTTPException(503)
      const source = PreservedRecordSourceValue.create(intent.data.source)
      if (source instanceof Error) throw new SoftwareLicenseHTTPException(503)
      if (
        source.props.ownerContext !== "software-license" ||
        source.props.recordKind !== "license-record" ||
        source.props.recordId !== String(c.req.valid("param").id) ||
        source.props.sourceNamespace !== c.env.RECORD_SOURCE_NAMESPACE
      )
        throw new SoftwareLicenseHTTPException(404)
      const body = c.req.valid("json")
      const target = body.decision_target
      if (
        proposal.version !== target.proposal_version ||
        proposal.digest !== target.proposal_digest
      )
        throw new SoftwareLicenseHTTPException(409)
      if (
        (action === "approve" &&
          (proposal.status === "approved" || proposal.status === "executed")) ||
        (action === "reject" && (proposal.status === "rejected" || proposal.status === "returned"))
      ) {
        const attestations = await query.listAttestations(proposal.caseId)
        if (attestations instanceof Error) throw new SoftwareLicenseHTTPException(503)
        const original = attestations.find(
          (attestation) =>
            attestation.actorAccountId === authentication.accountId &&
            attestation.taskKey === target.task_key &&
            attestation.round === target.task_round &&
            (attestation.action === action ||
              (action === "reject" && attestation.action === "return")) &&
            attestation.comment === body.comment,
        )
        if (original === undefined) throw new SoftwareLicenseHTTPException(403)
        await c.env.DB.batch([...technical])
        return c.json(
          { status: proposal.status === "executed" ? "approved" : proposal.status },
          200,
        )
      }
      const accountGuard = await new CompanyAuthoritySnapshotGuardAdapter({
        database: c.env.DB,
      }).prepare({
        accountIds: [authentication.accountId],
        employeeCodes: [],
      })
      if (accountGuard instanceof Error) throw new SoftwareLicenseHTTPException(503)
      const employees = await new CompanyEmployeeDirectoryReadAdapter({
        env: {
          DB: c.env.DB,
          COMPANY_TIME_ZONE: c.env.COMPANY_TIME_ZONE,
          NOW: at.toISOString(),
        },
      }).findForAccountIds([authentication.accountId])
      if (employees instanceof Error) throw new SoftwareLicenseHTTPException(503)
      const employee = employees[0]?.employee
      if (employee === undefined) throw new SoftwareLicenseHTTPException(403)
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
      if (decision instanceof CompanyConflictError) throw new SoftwareLicenseHTTPException(409)
      if (decision instanceof Error) throw new SoftwareLicenseHTTPException(403)
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
      if (operation === undefined) throw new SoftwareLicenseHTTPException(503)
      const approved = await operation.execute(command)
      if (approved instanceof Error) throw new SoftwareLicenseHTTPException(409)
      return c.json({ status: approved.caseStatus }, 200)
    },
  )
}
