import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { commendationFactory } from "@/contexts/commendation/interface/request-environment/commendation-factory"
import { commendationIdSchema } from "@/contexts/commendation/interface/http/commendation-input-schemas"
import { CaptureCommendationRecordAdapter } from "@/contexts/commendation/infrastructure/adapters/capture-commendation-record.adapter"
import { CommendationActorReadAdapter } from "@/contexts/commendation/infrastructure/adapters/commendation-actor-read.adapter"
import {
  CommendationForbiddenError,
  CommendationInputError,
  CommendationNotFoundError,
  CommendationConflictError,
  CommendationUnavailableError,
} from "@/contexts/commendation/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** 表彰記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createCommendationPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return commendationFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: commendationIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new CommendationForbiddenError()
      const request = c.req.valid("json")
      const commendationId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "commendation",
          recordKind: "commendation-record",
          recordId: String(commendationId),
          sourceNamespace,
          authorize: () => new CommendationActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureCommendationRecordAdapter(c).prepare({ commendationId, sourceNamespace }),
        },
        prepareTask: (input) => prepareCompanyRecordProcedureTask(c, input),
      }
      const common = {
        authentication,
        procedureKey: request.procedure_key,
        conditions: request.conditions,
      }
      const submit = async () => {
        if (mode === "create") {
          const idempotencyKey = c.req.valid("header")["idempotency-key"]
          if (idempotencyKey === undefined)
            throw new CommendationInputError({ message: "invalid preservation request" })
          return submitSystemRecordPreservation(adapterContext, {
            ...common,
            revision: { mode: "create", idempotencyKey },
          })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new CommendationInputError({ message: "invalid preservation request" })
        return submitSystemRecordPreservation(adapterContext, {
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
            throw new CommendationInputError({ message: submitted.message })
          case "forbidden":
            throw new CommendationForbiddenError()
          case "not_found":
            throw new CommendationNotFoundError()
          case "conflict":
            throw new CommendationConflictError()
          case "unavailable":
            throw new CommendationUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
