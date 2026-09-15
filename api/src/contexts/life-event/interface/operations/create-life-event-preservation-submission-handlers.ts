import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { lifeEventFactory } from "@/contexts/life-event/interface/request-environment/life-event-factory"
import { lifeEventIdSchema } from "@/contexts/life-event/interface/http/life-event-input-schemas"
import { CaptureLifeEventRecordAdapter } from "@/contexts/life-event/infrastructure/adapters/capture-life-event-record.adapter"
import { LifeEventActorReadAdapter } from "@/contexts/life-event/infrastructure/adapters/life-event-actor-read.adapter"
import {
  LifeEventForbiddenError,
  LifeEventInputError,
  LifeEventNotFoundError,
  LifeEventConflictError,
  LifeEventUnavailableError,
} from "@/contexts/life-event/interface/errors"
import { PrepareCompanyRecordProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-task.adapter"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** life event記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createLifeEventPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return lifeEventFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: lifeEventIdSchema, number: z.coerce.number().int().positive().safe().optional() }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new LifeEventForbiddenError()
      const request = c.req.valid("json")
      const lifeEventId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "life-event",
          recordKind: "life-event-record",
          recordId: String(lifeEventId),
          sourceNamespace,
          authorize: () => new LifeEventActorReadAdapter(c).prepare(),
          capture: () => new CaptureLifeEventRecordAdapter(c).prepare({ lifeEventId, sourceNamespace }),
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
            throw new LifeEventInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new LifeEventInputError({ message: "invalid preservation request" })
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
            throw new LifeEventInputError({ message: submitted.message })
          case "forbidden":
            throw new LifeEventForbiddenError()
          case "not_found":
            throw new LifeEventNotFoundError()
          case "conflict":
            throw new LifeEventConflictError()
          case "unavailable":
            throw new LifeEventUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
