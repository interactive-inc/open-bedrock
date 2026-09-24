import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { employeeWorkStyleFactory } from "@/contexts/work-style/interface/request-environment/work-style-factory"
import { employeeWorkStyleIdSchema } from "@/contexts/work-style/interface/http/work-style-input-schemas"
import { CaptureEmployeeWorkStyleRecordAdapter } from "@/contexts/work-style/infrastructure/adapters/capture-employee-work-style-record.adapter"
import { EmployeeWorkStyleActorReadAdapter } from "@/contexts/work-style/infrastructure/adapters/work-style-actor-read.adapter"
import {
  EmployeeWorkStyleForbiddenError,
  EmployeeWorkStyleInputError,
  EmployeeWorkStyleNotFoundError,
  EmployeeWorkStyleConflictError,
  EmployeeWorkStyleUnavailableError,
} from "@/contexts/work-style/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { submitSystemRecordPreservation } from "@system/interface/operations/submit-system-record-preservation"
import { RecordPreservationSubmissionError } from "@system/application/records/errors"

/** 勤務形態記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createEmployeeWorkStylePreservationSubmissionHandlers(mode: "create" | "resubmit") {
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
  return employeeWorkStyleFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: employeeWorkStyleIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new EmployeeWorkStyleForbiddenError()
      const request = c.req.valid("json")
      const employeeWorkStyleId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapterContext: Parameters<typeof submitSystemRecordPreservation>[0] = {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "work-style",
          recordKind: "employee-work-style-record",
          recordId: String(employeeWorkStyleId),
          sourceNamespace,
          authorize: () => new EmployeeWorkStyleActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureEmployeeWorkStyleRecordAdapter(c).prepare({
              employeeWorkStyleId,
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
            throw new EmployeeWorkStyleInputError({ message: "invalid preservation request" })
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
          throw new EmployeeWorkStyleInputError({ message: "invalid preservation request" })
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
            throw new EmployeeWorkStyleInputError({ message: submitted.message })
          case "forbidden":
            throw new EmployeeWorkStyleForbiddenError()
          case "not_found":
            throw new EmployeeWorkStyleNotFoundError()
          case "conflict":
            throw new EmployeeWorkStyleConflictError()
          case "unavailable":
            throw new EmployeeWorkStyleUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
