import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { antisocialCheckIdSchema } from "@/contexts/antisocial-check/interface/http/antisocial-check-input-schemas"
import { CaptureAntisocialCheckRecordAdapter } from "@/contexts/antisocial-check/infrastructure/adapters/capture-antisocial-check-record.adapter"
import { AntisocialCheckActorReadAdapter } from "@/contexts/antisocial-check/infrastructure/adapters/antisocial-check-actor-read.adapter"
import {
  AntisocialCheckForbiddenError,
  AntisocialCheckInputError,
  AntisocialCheckNotFoundError,
  AntisocialCheckConflictError,
  AntisocialCheckUnavailableError,
} from "@/contexts/antisocial-check/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** antisocial check記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createAntisocialCheckPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return antisocialCheckFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: antisocialCheckIdSchema, number: z.coerce.number().int().positive().safe().optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new AntisocialCheckForbiddenError()
      const request = c.req.valid("json")
      const antisocialCheckId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "antisocial-check",
          recordKind: "antisocial-check-record",
          recordId: String(antisocialCheckId),
          sourceNamespace,
          authorize: () => new AntisocialCheckActorReadAdapter(c).prepare(),
          capture: () => new CaptureAntisocialCheckRecordAdapter(c).prepare({ antisocialCheckId, sourceNamespace }),
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
            throw new AntisocialCheckInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new AntisocialCheckInputError({ message: "invalid preservation request" })
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
            throw new AntisocialCheckInputError({ message: submitted.message })
          case "forbidden":
            throw new AntisocialCheckForbiddenError()
          case "not_found":
            throw new AntisocialCheckNotFoundError()
          case "conflict":
            throw new AntisocialCheckConflictError()
          case "unavailable":
            throw new AntisocialCheckUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
