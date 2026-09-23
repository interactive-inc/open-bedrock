import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { careerFactory } from "@/contexts/career/interface/request-environment/career-factory"
import { careerRecordRouteSchema } from "@/contexts/career/interface/http/career-input-schemas"
import { CaptureCareerRecordAdapter } from "@/contexts/career/infrastructure/adapters/capture-career-record.adapter"
import { CareerActorReadAdapter } from "@/contexts/career/infrastructure/adapters/career-actor-read.adapter"
import {
  CareerForbiddenError,
  CareerInputError,
  CareerNotFoundError,
  CareerConflictError,
  CareerUnavailableError,
} from "@/contexts/career/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** career記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createCareerPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return careerFactory.createHandlers(
    zValidator("param", careerRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new CareerForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "career",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new CareerActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureCareerRecordAdapter(c).prepare({ recordKind, recordId, sourceNamespace }),
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
            throw new CareerInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new CareerInputError({ message: "invalid preservation request" })
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
            throw new CareerInputError({ message: submitted.message })
          case "forbidden":
            throw new CareerForbiddenError()
          case "not_found":
            throw new CareerNotFoundError()
          case "conflict":
            throw new CareerConflictError()
          case "unavailable":
            throw new CareerUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
