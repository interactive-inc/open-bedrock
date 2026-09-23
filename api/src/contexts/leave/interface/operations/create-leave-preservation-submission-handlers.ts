import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { leaveFactory } from "@/contexts/leave/interface/request-environment/leave-factory"
import { leaveRecordRouteSchema } from "@/contexts/leave/interface/http/leave-input-schemas"
import { CaptureLeaveRecordAdapter } from "@/contexts/leave/infrastructure/adapters/capture-leave-record.adapter"
import { LeaveActorReadAdapter } from "@/contexts/leave/infrastructure/adapters/leave-actor-read.adapter"
import {
  LeaveForbiddenError,
  LeaveInputError,
  LeaveNotFoundError,
  LeaveConflictError,
  LeaveUnavailableError,
} from "@/contexts/leave/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** leave記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createLeavePreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return leaveFactory.createHandlers(
    zValidator("param", leaveRecordRouteSchema),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new LeaveForbiddenError()
      const request = c.req.valid("json")
      const { recordKind, recordId } = c.req.valid("param")
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "leave",
          recordKind,
          recordId,
          sourceNamespace,
          authorize: () => new LeaveActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureLeaveRecordAdapter(c).prepare({ recordKind, recordId, sourceNamespace }),
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
            throw new LeaveInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new LeaveInputError({ message: "invalid preservation request" })
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
            throw new LeaveInputError({ message: submitted.message })
          case "forbidden":
            throw new LeaveForbiddenError()
          case "not_found":
            throw new LeaveNotFoundError()
          case "conflict":
            throw new LeaveConflictError()
          case "unavailable":
            throw new LeaveUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
