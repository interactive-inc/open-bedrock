import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { ringiFactory } from "@/contexts/ringi/interface/request-environment/ringi-factory"
import { ringiRecordRouteSchema } from "@/contexts/ringi/interface/http/ringi-input-schemas"
import { CaptureRingiRecordAdapter } from "@/contexts/ringi/infrastructure/adapters/capture-ringi-record.adapter"
import { RingiActorReadAdapter } from "@/contexts/ringi/infrastructure/adapters/ringi-actor-read.adapter"
import {
  RingiForbiddenError,
  RingiInputError,
  RingiNotFoundError,
  RingiConflictError,
  RingiUnavailableError,
} from "@/contexts/ringi/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** ringi記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createRingiPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return ringiFactory.createHandlers(
    zValidator("param", ringiRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new RingiForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "ringi",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new RingiActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureRingiRecordAdapter(c).prepare({
              recordKind,
              recordId,
              sourceNamespace,
            }),
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
            throw new RingiInputError({ message: "invalid preservation request" })
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
          throw new RingiInputError({ message: "invalid preservation request" })
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
            throw new RingiInputError({ message: submitted.message })
          case "forbidden":
            throw new RingiForbiddenError()
          case "not_found":
            throw new RingiNotFoundError()
          case "conflict":
            throw new RingiConflictError()
          case "unavailable":
            throw new RingiUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
