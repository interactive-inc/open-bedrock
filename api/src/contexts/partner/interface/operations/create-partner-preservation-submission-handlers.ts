import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { partnerFactory } from "@/contexts/partner/interface/request-environment/partner-factory"
import { partnerRecordRouteSchema } from "@/contexts/partner/interface/http/partner-input-schemas"
import { CapturePartnerRecordAdapter } from "@/contexts/partner/infrastructure/adapters/capture-partner-record.adapter"
import { PartnerActorReadAdapter } from "@/contexts/partner/infrastructure/adapters/partner-actor-read.adapter"
import {
  PartnerForbiddenError,
  PartnerInputError,
  PartnerNotFoundError,
  PartnerConflictError,
  PartnerUnavailableError,
} from "@/contexts/partner/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** partner記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createPartnerPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return partnerFactory.createHandlers(
    zValidator("param", partnerRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new PartnerForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "partner",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new PartnerActorReadAdapter(c).prepare(),
          capture: () =>
            new CapturePartnerRecordAdapter(c).prepare({
              recordKind,
              recordId,
              sourceNamespace,
            }),
        },
        prepareTask: (input) => new PrepareCompanyRecordProcedureTaskAdapter(c).prepare(input),
      })
      const common = {
        authentication,
        procedureKey: request.procedure_key,
        conditions: request.conditions,
      }
      const submit = async () => {
        if (mode === "create") {
          const idempotencyKey = c.req.valid("header")["idempotency-key"]
          if (idempotencyKey === undefined)
            throw new PartnerInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new PartnerInputError({ message: "invalid preservation request" })
        return adapter.execute({
          ...common,
          revision: {
            mode: "resubmit",
            number,
            previousVersion: request.previous_version,
            previousDigest: request.previous_digest,
          },
        })
      }
      const submitted = await submit()
      if (submitted instanceof RecordPreservationSubmissionError) {
        switch (submitted.code) {
          case "invalid":
            throw new PartnerInputError({ message: submitted.message })
          case "forbidden":
            throw new PartnerForbiddenError()
          case "not_found":
            throw new PartnerNotFoundError()
          case "conflict":
            throw new PartnerConflictError()
          case "unavailable":
            throw new PartnerUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
