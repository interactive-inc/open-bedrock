import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { shiftFactory } from "@/contexts/shift/interface/request-environment/shift-factory"
import { shiftRecordRouteSchema } from "@/contexts/shift/interface/http/shift-input-schemas"
import { CaptureShiftRecordAdapter } from "@/contexts/shift/infrastructure/adapters/capture-shift-record.adapter"
import { ShiftActorReadAdapter } from "@/contexts/shift/infrastructure/adapters/shift-actor-read.adapter"
import {
  ShiftForbiddenError,
  ShiftInputError,
  ShiftNotFoundError,
  ShiftConflictError,
  ShiftUnavailableError,
} from "@/contexts/shift/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** shift記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createShiftPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return shiftFactory.createHandlers(
    zValidator("param", shiftRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new ShiftForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "shift",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new ShiftActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureShiftRecordAdapter(c).prepare({ recordKind, recordId, sourceNamespace }),
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
            throw new ShiftInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new ShiftInputError({ message: "invalid preservation request" })
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
            throw new ShiftInputError({ message: submitted.message })
          case "forbidden":
            throw new ShiftForbiddenError()
          case "not_found":
            throw new ShiftNotFoundError()
          case "conflict":
            throw new ShiftConflictError()
          case "unavailable":
            throw new ShiftUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
