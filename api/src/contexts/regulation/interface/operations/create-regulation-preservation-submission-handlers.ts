import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { regulationFactory } from "@/contexts/regulation/interface/request-environment/regulation-factory"
import { regulationRecordRouteSchema } from "@/contexts/regulation/interface/http/regulation-input-schemas"
import { CaptureRegulationRecordAdapter } from "@/contexts/regulation/infrastructure/adapters/capture-regulation-record.adapter"
import { RegulationActorReadAdapter } from "@/contexts/regulation/infrastructure/adapters/regulation-actor-read.adapter"
import {
  RegulationForbiddenError,
  RegulationInputError,
  RegulationNotFoundError,
  RegulationConflictError,
  RegulationUnavailableError,
} from "@/contexts/regulation/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** regulation記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createRegulationPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return regulationFactory.createHandlers(
    zValidator("param", regulationRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new RegulationForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "regulation",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new RegulationActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureRegulationRecordAdapter(c).prepare({
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
            throw new RegulationInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new RegulationInputError({ message: "invalid preservation request" })
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
            throw new RegulationInputError({ message: submitted.message })
          case "forbidden":
            throw new RegulationForbiddenError()
          case "not_found":
            throw new RegulationNotFoundError()
          case "conflict":
            throw new RegulationConflictError()
          case "unavailable":
            throw new RegulationUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
