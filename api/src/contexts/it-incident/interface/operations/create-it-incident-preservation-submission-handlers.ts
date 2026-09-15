import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { itIncidentFactory } from "@/contexts/it-incident/interface/request-environment/it-incident-factory"
import { itIncidentIdSchema } from "@/contexts/it-incident/interface/http/it-incident-input-schemas"
import { CaptureItIncidentRecordAdapter } from "@/contexts/it-incident/infrastructure/adapters/capture-it-incident-record.adapter"
import { ItIncidentActorReadAdapter } from "@/contexts/it-incident/infrastructure/adapters/it-incident-actor-read.adapter"
import {
  ItIncidentForbiddenError,
  ItIncidentInputError,
  ItIncidentNotFoundError,
  ItIncidentConflictError,
  ItIncidentUnavailableError,
} from "@/contexts/it-incident/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** ITインシデント記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createItIncidentPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return itIncidentFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: itIncidentIdSchema, number: itIncidentIdSchema.optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new ItIncidentForbiddenError()
      const request = c.req.valid("json")
      const itIncidentId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "it-incident",
          recordKind: "it-incident-record",
          recordId: String(itIncidentId),
          sourceNamespace,
          authorize: () => new ItIncidentActorReadAdapter(c).prepare(),
          capture: () => new CaptureItIncidentRecordAdapter(c).prepare({ itIncidentId, sourceNamespace }),
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
            throw new ItIncidentInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new ItIncidentInputError({ message: "invalid preservation request" })
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
            throw new ItIncidentInputError({ message: submitted.message })
          case "forbidden":
            throw new ItIncidentForbiddenError()
          case "not_found":
            throw new ItIncidentNotFoundError()
          case "conflict":
            throw new ItIncidentConflictError()
          case "unavailable":
            throw new ItIncidentUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
