import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { oneOnOneFactory } from "@/contexts/one-on-one/interface/request-environment/one-on-one-factory"
import { oneOnOneIdSchema } from "@/contexts/one-on-one/interface/http/one-on-one-input-schemas"
import { CaptureOneOnOneRecordAdapter } from "@/contexts/one-on-one/infrastructure/adapters/capture-one-on-one-record.adapter"
import { OneOnOneActorReadAdapter } from "@/contexts/one-on-one/infrastructure/adapters/one-on-one-actor-read.adapter"
import {
  OneOnOneForbiddenError,
  OneOnOneInputError,
  OneOnOneNotFoundError,
  OneOnOneConflictError,
  OneOnOneUnavailableError,
} from "@/contexts/one-on-one/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** 1on1記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createOneOnOnePreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return oneOnOneFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: oneOnOneIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new OneOnOneForbiddenError()
      const request = c.req.valid("json")
      const oneOnOneId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "one-on-one",
          recordKind: "one-on-one-record",
          recordId: String(oneOnOneId),
          sourceNamespace,
          authorize: () => new OneOnOneActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureOneOnOneRecordAdapter(c).prepare({ oneOnOneId, sourceNamespace }),
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
            throw new OneOnOneInputError({ message: "invalid preservation request" })
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
          throw new OneOnOneInputError({ message: "invalid preservation request" })
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
            throw new OneOnOneInputError({ message: submitted.message })
          case "forbidden":
            throw new OneOnOneForbiddenError()
          case "not_found":
            throw new OneOnOneNotFoundError()
          case "conflict":
            throw new OneOnOneConflictError()
          case "unavailable":
            throw new OneOnOneUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
