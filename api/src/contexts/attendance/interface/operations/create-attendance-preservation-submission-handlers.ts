import { uuidSchema } from "@/lib/validation/uuid.schema"
import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { attendanceFactory } from "@/contexts/attendance/interface/request-environment/attendance-factory"
import { AttendanceRecordSourceAuthorizationAdapter } from "@/contexts/attendance/infrastructure/adapters/attendance-record-source-authorization.adapter"
import { CaptureAttendanceRecordAdapter } from "@/contexts/attendance/infrastructure/adapters/capture-attendance-record.adapter"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** 打刻原記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createAttendancePreservationSubmissionHandlers(mode: "create" | "resubmit") {
  const numberSchema = z.coerce.number().int().positive().safe()
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
  return attendanceFactory.createHandlers(
    zValidator("param", z.strictObject({ id: uuidSchema, number: numberSchema.optional() })),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new SystemForbiddenError()
      const request = c.req.valid("json")
      const recordId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "attendance",
          recordKind: "attendance-record",
          recordId: String(recordId),
          sourceNamespace,
          authorize: () => new AttendanceRecordSourceAuthorizationAdapter(c).prepare(),
          capture: () =>
            new CaptureAttendanceRecordAdapter(c).prepare({ recordId, sourceNamespace }),
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
          if (idempotencyKey === undefined) return new RecordPreservationSubmissionError("invalid")
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
          return new RecordPreservationSubmissionError("invalid")
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
        const statuses: Readonly<
          Record<RecordPreservationSubmissionError["code"], 400 | 403 | 404 | 409 | 503>
        > = {
          invalid: 400,
          forbidden: 403,
          not_found: 404,
          conflict: 409,
          unavailable: 503,
        }
        throw new SystemHTTPException({
          status: statuses[submitted.code],
          code: `record_preservation_${submitted.code}`,
          detail: submitted.message,
        })
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
