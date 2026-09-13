import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { SoftwareLicenseHTTPException } from "@/contexts/software-license/interface/errors"
import { RevalidateLicenseRecordSourceAdapter } from "@/contexts/software-license/infrastructure/adapters/revalidate-license-record-source.adapter"
import { RevalidateRecordPreservationExecutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-record-preservation-execution.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { preparePreservedRecordWriteAuthorization } from "@system/interface/authorization/prepare-preserved-record-write-authorization"
import { recordPreservationIntentSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { FinalizePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/finalize-preserved-record-persistence.adapter"
import { FinalizePreservedRecord } from "@system/application/records/finalize-preserved-record"

// @authorization service - 承認済み内容、現在の保全権限、原台帳、Company承認資格を再検査して一回だけ確定する
export const POST = softwareLicenseFactory.createHandlers(
  ensureLicenseEnabled,
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: licenseIdSchema, number: licenseIdSchema })),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new SoftwareLicenseHTTPException(403)
    const namespace = z
      .string()
      .regex(/^\S{1,255}$/)
      .safeParse(c.env.RECORD_SOURCE_NAMESPACE)
    if (!namespace.success) throw new SoftwareLicenseHTTPException(503)
    const at = c.var.now()
    const proof = await preparePreservedRecordWriteAuthorization(c, { authentication, at })
    if (proof instanceof Error) throw new SoftwareLicenseHTTPException(503)
    if (proof === null) throw new SoftwareLicenseHTTPException(403)
    const technical = proof.assertions(at)
    if (technical instanceof Error || technical[0] === undefined)
      throw new SoftwareLicenseHTTPException(403)
    const proposal = await new SystemD1ProposalAdapter({
      env: c.env,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    }).findByNumber(c.req.valid("param").number)
    if (proposal instanceof Error) throw new SoftwareLicenseHTTPException(503)
    if (proposal === null) throw new SoftwareLicenseHTTPException(404)
    if (proposal.digest !== c.req.valid("json").proposal_digest)
      throw new SoftwareLicenseHTTPException(409)
    const intent = recordPreservationIntentSchema.safeParse(JSON.parse(proposal.bodyJson))
    const value = await RecordPreservationProposalValue.restore(JSON.parse(proposal.bodyJson))
    if (!intent.success || value instanceof Error) throw new SoftwareLicenseHTTPException(503)
    if (intent.data.actorAccountId !== authentication.accountId)
      throw new SoftwareLicenseHTTPException(403)
    const source = PreservedRecordSourceValue.create(intent.data.source)
    if (source instanceof Error) throw new SoftwareLicenseHTTPException(503)
    if (source.props.recordId !== String(c.req.valid("param").id))
      throw new SoftwareLicenseHTTPException(403)
    const current = await new RevalidateLicenseRecordSourceAdapter({
      env: c.env,
      var: c.var,
      sourceNamespace: namespace.data,
    }).prepare(source)
    if (current instanceof Error) throw new SoftwareLicenseHTTPException(409)
    const finalization = value.toFinalization({ actorAccountId: authentication.accountId, at })
    if (finalization instanceof Error) throw new SoftwareLicenseHTTPException(409)
    const authorization = ExecutionAuthorizationEntity.create({
      id: `record-preservation:${proposal.caseId}`,
      caseId: proposal.caseId,
      operationKey: "system.record.preserve",
      proposalDigest: proposal.digest,
      grantedToAccountId: authentication.accountId,
      grantedAt: at,
      expiresAt: new Date(at.getTime() + 60_000),
      usedAt: null,
    })
    if (authorization instanceof Error) throw new SoftwareLicenseHTTPException(503)
    const assertions: readonly [D1PreparedStatement, ...D1PreparedStatement[]] = [
      technical[0],
      ...technical.slice(1),
      ...current.assertions,
    ]
    if (proposal.status === "executed") {
      const existing = await new FinalizePreservedRecordPersistenceAdapter({
        env: c.env,
        assertions,
        authorization,
        executionGuards: [technical[0]],
      }).find(finalization)
      if (existing === null || existing instanceof Error)
        throw new SoftwareLicenseHTTPException(409)
      return c.json(
        { record_id: existing.snapshot.id, finalized_at: existing.snapshot.finalizedAt },
        200,
      )
    }
    if (proposal.status !== "approved") throw new SoftwareLicenseHTTPException(409)
    const company = await new RevalidateRecordPreservationExecutionAdapter(c).prepare({
      applicationId: proposal.number,
      caseId: proposal.caseId,
      seriesId: proposal.seriesId,
      proposal: value,
      executorAccountId: authentication.accountId,
      executedAt: at,
    })
    if (company instanceof Error || company[0] === undefined)
      throw new SoftwareLicenseHTTPException(403)
    const completed = await new FinalizePreservedRecord({
      env: c.env,
      var: c.var,
      persistence: new FinalizePreservedRecordPersistenceAdapter({
        env: c.env,
        assertions,
        authorization,
        executionGuards: [company[0], ...company.slice(1)],
      }),
    }).execute(finalization)
    if (completed instanceof Error) throw new SoftwareLicenseHTTPException(409)
    return c.json(
      { record_id: completed.snapshot.id, finalized_at: completed.snapshot.finalizedAt },
      200,
    )
  },
)
