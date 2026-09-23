import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { thanksFactory } from "@/contexts/thanks/interface/request-environment/thanks-factory"
import { thanksRecordRouteSchema } from "@/contexts/thanks/interface/http/thanks-input-schemas"
import { CaptureThanksRecordAdapter } from "@/contexts/thanks/infrastructure/adapters/capture-thanks-record.adapter"
import { ThanksActorReadAdapter } from "@/contexts/thanks/infrastructure/adapters/thanks-actor-read.adapter"
import {
  ThanksForbiddenError,
  ThanksInputError,
  ThanksNotFoundError,
  ThanksConflictError,
  ThanksUnavailableError,
} from "@/contexts/thanks/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** thanks記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createThanksPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return thanksFactory.createHandlers(
    zValidator(
      "param",
      thanksRecordRouteSchema,
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new ThanksForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "thanks",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new ThanksActorReadAdapter(c).prepare(),
          capture: () => new CaptureThanksRecordAdapter(c).prepare({ recordKind, recordId, sourceNamespace }),
        },
        prepareTask: (input) => prepareCompanyRecordProcedureTask(c, input),
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
            throw new ThanksInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new ThanksInputError({ message: "invalid preservation request" })
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
            throw new ThanksInputError({ message: submitted.message })
          case "forbidden":
            throw new ThanksForbiddenError()
          case "not_found":
            throw new ThanksNotFoundError()
          case "conflict":
            throw new ThanksConflictError()
          case "unavailable":
            throw new ThanksUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
