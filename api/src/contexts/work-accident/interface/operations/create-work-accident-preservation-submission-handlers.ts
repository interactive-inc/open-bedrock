import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { workAccidentFactory } from "@/contexts/work-accident/interface/request-environment/work-accident-factory"
import { workAccidentIdSchema } from "@/contexts/work-accident/interface/http/work-accident-input-schemas"
import { CaptureWorkAccidentRecordAdapter } from "@/contexts/work-accident/infrastructure/adapters/capture-work-accident-record.adapter"
import { WorkAccidentActorReadAdapter } from "@/contexts/work-accident/infrastructure/adapters/work-accident-actor-read.adapter"
import {
  WorkAccidentForbiddenError,
  WorkAccidentInputError,
  WorkAccidentNotFoundError,
  WorkAccidentConflictError,
  WorkAccidentUnavailableError,
} from "@/contexts/work-accident/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** 労災・事故記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createWorkAccidentPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return workAccidentFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: workAccidentIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new WorkAccidentForbiddenError()
      const request = c.req.valid("json")
      const workAccidentId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "work-accident",
          recordKind: "work-accident-record",
          recordId: String(workAccidentId),
          sourceNamespace,
          authorize: () => new WorkAccidentActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureWorkAccidentRecordAdapter(c).prepare({ workAccidentId, sourceNamespace }),
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
            throw new WorkAccidentInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new WorkAccidentInputError({ message: "invalid preservation request" })
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
            throw new WorkAccidentInputError({ message: submitted.message })
          case "forbidden":
            throw new WorkAccidentForbiddenError()
          case "not_found":
            throw new WorkAccidentNotFoundError()
          case "conflict":
            throw new WorkAccidentConflictError()
          case "unavailable":
            throw new WorkAccidentUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
