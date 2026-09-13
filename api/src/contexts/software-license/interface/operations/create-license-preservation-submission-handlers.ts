import { VerifyLicensePreservationReplayAdapter } from "@/contexts/software-license/infrastructure/adapters/verify-license-preservation-replay.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { softwareLicenseFactory } from "@/contexts/software-license/interface/request-environment/software-license-factory"
import { ensureLicenseEnabled } from "@/contexts/software-license/interface/middlewares/ensure-license-enabled"
import { licenseIdSchema } from "@/contexts/software-license/interface/http/license-input-schemas"
import { CaptureLicenseRecordAdapter } from "@/contexts/software-license/infrastructure/adapters/capture-license-record.adapter"
import { LicenseActorReadAdapter } from "@/contexts/software-license/infrastructure/adapters/license-actor-read.adapter"
import {
  SoftwareLicenseConflictError,
  SoftwareLicenseForbiddenError,
  SoftwareLicenseInputError,
  SoftwareLicenseNotFoundError,
  SoftwareLicenseUnavailableError,
} from "@/contexts/software-license/interface/errors"
import { PrepareRecordPreservationTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-record-preservation-task.adapter"
import { preparePreservedRecordWriteAuthorization } from "@system/interface/authorization/prepare-preserved-record-write-authorization"
import {
  recordPreservationRequestSchema,
  recordPreservationIntentSchema,
} from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { StorePreservedRecordContent } from "@system/application/records/store-preserved-record-content"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"

/** 初回提出と再提出で原記録の保全・会社資格・再送検査を共通化する。 */
export function createLicensePreservationSubmissionHandlers(mode: "create" | "resubmit") {
  const requestSchema = z.strictObject({
    procedure_key: procedureKeySchema,
    conditions: recordPreservationRequestSchema,
  })
  const schemas = {
    create: requestSchema,
    resubmit: requestSchema.extend({
      previous_version: z.number().int().positive().safe(),
      previous_digest: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  }
  return softwareLicenseFactory.createHandlers(
    ensureLicenseEnabled,
    zValidator(
      "param",
      z.strictObject({ id: licenseIdSchema, number: licenseIdSchema.optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SoftwareLicenseForbiddenError()
      const namespace = z
        .string()
        .regex(/^\S{1,255}$/)
        .safeParse(c.env.RECORD_SOURCE_NAMESPACE)
      if (!namespace.success)
        throw new SoftwareLicenseUnavailableError({
          message: "record source namespace is not configured",
        })
      const proof = await preparePreservedRecordWriteAuthorization(c, {
        authentication,
        at: c.var.now(),
      })
      if (proof instanceof Error) throw new SoftwareLicenseUnavailableError()
      if (proof === null) throw new SoftwareLicenseForbiddenError()
      const actor = await new LicenseActorReadAdapter(c).prepare()
      if (actor instanceof Error) throw new SoftwareLicenseForbiddenError()
      const request = c.req.valid("json")
      const licenseId = c.req.valid("param").id
      const query = new SystemD1ProposalAdapter({
        env: c.env,
        visibleCompletionOperationKeys: ["system.record.preserve"],
      })
      const resolveVersion = async () => {
        if (mode === "create") {
          const key = c.req.valid("header")["idempotency-key"]
          if (key === undefined)
            throw new SoftwareLicenseInputError({ message: "invalid preservation request" })
          const identity = CanonicalSystemJsonValue.create({
            operation: "software-license.record-preservation.request",
            accountId: authentication.accountId,
            key,
          })
          if (identity instanceof Error)
            throw new SoftwareLicenseInputError({ message: "invalid preservation request" })
          const digest = await ProposalDigestValue.create(identity)
          if (digest instanceof Error)
            throw new SoftwareLicenseInputError({ message: "invalid preservation request" })
          return {
            seriesId: `record-preservation:${digest.toString()}`,
            version: 1,
            supersedesProposalId: null,
          }
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new SoftwareLicenseInputError({ message: "invalid preservation request" })
        const previous = await query.findByNumber(number, request.previous_version)
        if (previous instanceof Error) throw new SoftwareLicenseUnavailableError()
        if (previous === null) throw new SoftwareLicenseNotFoundError()
        if (previous.createdByAccountId !== authentication.accountId)
          throw new SoftwareLicenseForbiddenError()
        if (
          previous.digest !== request.previous_digest ||
          !["returned", "rejected", "cancelled"].includes(previous.status)
        )
          throw new SoftwareLicenseConflictError()
        const oldIntent = recordPreservationIntentSchema.safeParse(JSON.parse(previous.bodyJson))
        if (!oldIntent.success) throw new SoftwareLicenseUnavailableError()
        const source = PreservedRecordSourceValue.create(oldIntent.data.source)
        if (source instanceof Error) throw new SoftwareLicenseUnavailableError()
        if (
          source.props.sourceNamespace !== namespace.data ||
          source.props.ownerContext !== "software-license" ||
          source.props.recordKind !== "license-record" ||
          source.props.recordId !== String(licenseId)
        )
          throw new SoftwareLicenseConflictError()
        if (!Number.isSafeInteger(previous.version + 1)) throw new SoftwareLicenseConflictError()
        return {
          seriesId: previous.seriesId,
          version: previous.version + 1,
          supersedesProposalId: previous.proposalId,
        }
      }
      const revision = await resolveVersion()
      const replay = async () => {
        const existing = await query.findBySeriesVersion({
          seriesId: revision.seriesId,
          version: revision.version,
          creatorAccountId: authentication.accountId,
        })
        if (existing instanceof Error) throw new SoftwareLicenseUnavailableError()
        if (existing === null) return null
        const stored = await RecordPreservationProposalValue.restore(JSON.parse(existing.bodyJson))
        const body = recordPreservationIntentSchema.safeParse(JSON.parse(existing.bodyJson))
        if (stored instanceof Error || !body.success) throw new SoftwareLicenseUnavailableError()
        const source = PreservedRecordSourceValue.create(body.data.source)
        if (source instanceof Error) throw new SoftwareLicenseUnavailableError()
        if (
          existing.supersedesProposalId !== revision.supersedesProposalId ||
          existing.procedureKey !== request.procedure_key ||
          !stored.matchesRequest(request.conditions) ||
          body.data.actorAccountId !== authentication.accountId ||
          source.props.sourceNamespace !== namespace.data ||
          source.props.ownerContext !== "software-license" ||
          source.props.recordKind !== "license-record" ||
          source.props.recordId !== String(licenseId)
        )
          throw new SoftwareLicenseConflictError({
            message: "preservation request differs from original",
          })
        const guards = proof.assertions(c.var.now())
        if (guards instanceof Error) throw new SoftwareLicenseForbiddenError()
        const verified = await new VerifyLicensePreservationReplayAdapter(c).execute([
          ...guards,
          ...actor.assertions,
        ])
        if (verified instanceof Error) throw new SoftwareLicenseForbiddenError()
        return {
          number: existing.number,
          case_id: existing.caseId,
          record_id: body.data.recordId,
          status: existing.status,
        }
      }
      const existing = await replay()
      if (existing !== null) return c.json(existing, 200)
      const captured = await new CaptureLicenseRecordAdapter(c).prepare({
        licenseId,
        sourceNamespace: namespace.data,
      })
      if (captured instanceof Error) throw new SoftwareLicenseForbiddenError()
      const stored = await new StorePreservedRecordContent(c).execute({
        source: captured.source.props,
        content: captured.content,
        ownerAccountId: authentication.accountId,
        now: c.var.now(),
      })
      if (stored instanceof Error) throw new SoftwareLicenseUnavailableError()
      const recordId = crypto.randomUUID()
      const proposal = await RecordPreservationProposalValue.fromRequest({
        request: request.conditions,
        recordId,
        source: stored.source,
        actorAccountId: authentication.accountId,
        attachmentId: stored.attachment.id,
        attachmentDigest: stored.attachment.plaintextSha256,
        sourceAuthorizationRef: captured.sourceAuthorizationRef,
        preservationId: crypto.randomUUID(),
        disclosurePolicyId: crypto.randomUUID(),
      })
      if (proposal instanceof Error)
        throw new SoftwareLicenseInputError({ message: "invalid preservation request" })
      const at = c.var.now()
      const task = await new PrepareRecordPreservationTaskAdapter(c).prepare({
        procedureKey: request.procedure_key,
        proposal,
        applicantAccountId: authentication.accountId,
        at,
      })
      if (task instanceof Error) throw new SoftwareLicenseForbiddenError()
      const finalization = proposal.toFinalization({ actorAccountId: authentication.accountId, at })
      if (finalization instanceof Error)
        throw new SoftwareLicenseInputError({ message: "invalid preservation request" })
      const verified = await new VerifyPreservedRecordContentAdapter(c).execute(
        finalization.record,
        "pending",
      )
      if (verified instanceof Error) throw new SoftwareLicenseUnavailableError()
      const guards = proof.assertions(c.var.now())
      if (guards instanceof Error) throw new SoftwareLicenseForbiddenError()
      const started = await new StartSystemProcedure({
        writer: new SystemD1WorkflowAdapter({
          env: c.env,
          startGuards: [
            ...guards,
            ...captured.assertions,
            ...task.resolved.guards,
            new PrepareAttachmentContentReadGuardAdapter(c).prepare(
              verified.attachment,
              at,
              "pending",
            ),
          ],
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
        subject: { context: "system", kind: "record-preservation", id: recordId, version: "1" },
      })
      if (started instanceof Error) {
        const concurrent = await replay()
        if (concurrent !== null) return c.json(concurrent, 200)
        throw new SoftwareLicenseConflictError({
          message: "preservation submission changed or failed",
        })
      }
      return c.json(
        {
          number: started.number,
          case_id: started.workflowCase.id,
          record_id: recordId,
          status: "pending",
        },
        201,
      )
    },
  )
}
