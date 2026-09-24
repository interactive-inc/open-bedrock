import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { meetingFactory } from "@/contexts/meeting/interface/request-environment/meeting-factory"
import { meetingRecordRouteSchema } from "@/contexts/meeting/interface/http/meeting-input-schemas"
import { CaptureMeetingRecordAdapter } from "@/contexts/meeting/infrastructure/adapters/capture-meeting-record.adapter"
import { MeetingActorReadAdapter } from "@/contexts/meeting/infrastructure/adapters/meeting-actor-read.adapter"
import {
  MeetingForbiddenError,
  MeetingInputError,
  MeetingNotFoundError,
  MeetingConflictError,
  MeetingUnavailableError,
} from "@/contexts/meeting/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** meeting記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createMeetingPreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return meetingFactory.createHandlers(
    zValidator("param", meetingRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new MeetingForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "meeting",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new MeetingActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureMeetingRecordAdapter(c).prepare({ recordKind, recordId, sourceNamespace }),
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
            throw new MeetingInputError({ message: "invalid preservation request" })
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
          throw new MeetingInputError({ message: "invalid preservation request" })
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
            throw new MeetingInputError({ message: submitted.message })
          case "forbidden":
            throw new MeetingForbiddenError()
          case "not_found":
            throw new MeetingNotFoundError()
          case "conflict":
            throw new MeetingConflictError()
          case "unavailable":
            throw new MeetingUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
