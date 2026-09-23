import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { resignationFactory } from "@/contexts/resignation/interface/request-environment/resignation-factory"
import { resignationIdSchema } from "@/contexts/resignation/interface/http/resignation-input-schemas"
import { CaptureResignationRecordAdapter } from "@/contexts/resignation/infrastructure/adapters/capture-resignation-record.adapter"
import { ResignationActorReadAdapter } from "@/contexts/resignation/infrastructure/adapters/resignation-actor-read.adapter"
import {
  ResignationForbiddenError,
  ResignationInputError,
  ResignationNotFoundError,
  ResignationConflictError,
  ResignationUnavailableError,
} from "@/contexts/resignation/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** resignation記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createResignationPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return resignationFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: resignationIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new ResignationForbiddenError()
      const request = c.req.valid("json")
      const resignationId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "resignation",
          recordKind: "resignation-record",
          recordId: String(resignationId),
          sourceNamespace,
          authorize: () => new ResignationActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureResignationRecordAdapter(c).prepare({ resignationId, sourceNamespace }),
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
            throw new ResignationInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new ResignationInputError({ message: "invalid preservation request" })
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
            throw new ResignationInputError({ message: submitted.message })
          case "forbidden":
            throw new ResignationForbiddenError()
          case "not_found":
            throw new ResignationNotFoundError()
          case "conflict":
            throw new ResignationConflictError()
          case "unavailable":
            throw new ResignationUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
