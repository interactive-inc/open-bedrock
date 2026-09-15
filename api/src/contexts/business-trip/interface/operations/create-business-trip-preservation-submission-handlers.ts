import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { businessTripIdSchema } from "@/contexts/business-trip/interface/http/business-trip-input-schemas"
import { CaptureBusinessTripRecordAdapter } from "@/contexts/business-trip/infrastructure/adapters/capture-business-trip-record.adapter"
import { BusinessTripActorReadAdapter } from "@/contexts/business-trip/infrastructure/adapters/business-trip-actor-read.adapter"
import {
  BusinessTripForbiddenError,
  BusinessTripInputError,
  BusinessTripNotFoundError,
  BusinessTripConflictError,
  BusinessTripUnavailableError,
} from "@/contexts/business-trip/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** 出張申請記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createBusinessTripPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return businessTripFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: businessTripIdSchema, number: z.coerce.number().int().positive().safe().optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new BusinessTripForbiddenError()
      const request = c.req.valid("json")
      const businessTripId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "business-trip",
          recordKind: "business-trip-record",
          recordId: String(businessTripId),
          sourceNamespace,
          authorize: () => new BusinessTripActorReadAdapter(c).prepare(),
          capture: () => new CaptureBusinessTripRecordAdapter(c).prepare({ businessTripId, sourceNamespace }),
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
            throw new BusinessTripInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new BusinessTripInputError({ message: "invalid preservation request" })
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
            throw new BusinessTripInputError({ message: submitted.message })
          case "forbidden":
            throw new BusinessTripForbiddenError()
          case "not_found":
            throw new BusinessTripNotFoundError()
          case "conflict":
            throw new BusinessTripConflictError()
          case "unavailable":
            throw new BusinessTripUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
