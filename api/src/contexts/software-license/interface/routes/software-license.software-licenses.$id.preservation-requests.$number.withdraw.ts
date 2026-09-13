import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { SoftwareLicenseHTTPException } from "@/contexts/software-license/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { recordPreservationIntentSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: licenseIdSchema, number: licenseIdSchema })),
  zValidator(
    "json",
    z.strictObject({
      proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string().trim().min(1).max(1000),
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
    const assertions = proof.assertions(at)
    if (assertions instanceof Error) throw new SoftwareLicenseHTTPException(403)
    const reader = new SystemD1ProposalAdapter({
      env: c.env,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    })
    const proposal = await reader.findByNumber(c.req.valid("param").number)
    if (proposal instanceof Error) throw new SoftwareLicenseHTTPException(503)
    if (proposal === null) throw new SoftwareLicenseHTTPException(404)
    if (proposal.createdByAccountId !== authentication.accountId)
      throw new SoftwareLicenseHTTPException(403)
    if (proposal.status !== "pending" || proposal.digest !== c.req.valid("json").proposal_digest)
      throw new SoftwareLicenseHTTPException(409)
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
    const guard = await new PrepareSystemCaseReadGuardAdapter(c).prepare({
      caseId: proposal.caseId,
      accountId: authentication.accountId,
      at,
    })
    if (guard instanceof Error) throw new SoftwareLicenseHTTPException(503)
    const current = await reader.findByNumber(proposal.number)
    if (
      current === null ||
      current instanceof Error ||
      current.caseId !== proposal.caseId ||
      current.digest !== proposal.digest ||
      current.status !== "pending"
    )
      throw new SoftwareLicenseHTTPException(409)

    const audit = SystemAuditEventEntity.create({
      actorAccountId: authentication.accountId,
      action: "system.record.preservation.withdrawn",
      targetType: "system:case",
      targetId: proposal.caseId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ relation: "applicant" }),
      beforeJson: JSON.stringify({ status: "pending" }),
      afterJson: JSON.stringify({ status: "cancelled" }),
      metadataJson: JSON.stringify({
        proposal_digest: proposal.digest,
        reason: c.req.valid("json").reason,
      }),
      occurredAt: at,
    })
    if (audit instanceof Error) throw new SoftwareLicenseHTTPException(503)
    const cancelled = await new CancelSystemProcedure(
      new SystemD1WorkflowAdapter({
        env: c.env,
        cancelGuards: [...assertions, guard(at)],
        cancelEffects: new SystemAuditEventRepository(c).prepareAppend(audit),
      }),
    ).run({
      number: proposal.number,
      createdByAccountId: authentication.accountId,
      cancelledAt: at,
    })
    if (cancelled !== true) throw new SoftwareLicenseHTTPException(409)
    return c.json({ status: "cancelled" }, 200)
  },
)
