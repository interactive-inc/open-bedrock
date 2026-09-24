import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { compensationChangeFactory } from "@/contexts/compensation-change/interface/request-environment/compensation-change-factory"
import { compensationChangeRecordRouteSchema } from "@/contexts/compensation-change/interface/http/compensation-change-input-schemas"
import { CaptureCompensationChangeRecordAdapter } from "@/contexts/compensation-change/infrastructure/adapters/capture-compensation-change-record.adapter"
import { CompensationChangeActorReadAdapter } from "@/contexts/compensation-change/infrastructure/adapters/compensation-change-actor-read.adapter"
import {
  CompensationChangeForbiddenError,
  CompensationChangeInputError,
  CompensationChangeNotFoundError,
  CompensationChangeConflictError,
  CompensationChangeUnavailableError,
} from "@/contexts/compensation-change/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** compensation-change記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createCompensationChangePreservationSubmissionHandlers(
  mode: "create" | "resubmit",
) {
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
  return compensationChangeFactory.createHandlers(
    zValidator("param", compensationChangeRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new CompensationChangeForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "compensation-change",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new CompensationChangeActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureCompensationChangeRecordAdapter(c).prepare({
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
            throw new CompensationChangeInputError({ message: "invalid preservation request" })
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
          throw new CompensationChangeInputError({ message: "invalid preservation request" })
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
            throw new CompensationChangeInputError({ message: submitted.message })
          case "forbidden":
            throw new CompensationChangeForbiddenError()
          case "not_found":
            throw new CompensationChangeNotFoundError()
          case "conflict":
            throw new CompensationChangeConflictError()
          case "unavailable":
            throw new CompensationChangeUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
