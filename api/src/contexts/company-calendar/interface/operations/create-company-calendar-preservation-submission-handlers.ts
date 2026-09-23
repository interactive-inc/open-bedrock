import { prepareCompanyRecordProcedureTask } from "@/contexts/company/interface/operations/prepare-company-record-procedure-task"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { companyCalendarDayFactory } from "@/contexts/company-calendar/interface/request-environment/company-calendar-factory"
import { companyCalendarDayIdSchema } from "@/contexts/company-calendar/interface/http/company-calendar-input-schemas"
import { CaptureCompanyCalendarDayRecordAdapter } from "@/contexts/company-calendar/infrastructure/adapters/capture-company-calendar-record.adapter"
import { CompanyCalendarDayActorReadAdapter } from "@/contexts/company-calendar/infrastructure/adapters/company-calendar-actor-read.adapter"
import {
  CompanyCalendarDayForbiddenError,
  CompanyCalendarDayInputError,
  CompanyCalendarDayNotFoundError,
  CompanyCalendarDayConflictError,
  CompanyCalendarDayUnavailableError,
} from "@/contexts/company-calendar/interface/errors"
import { recordPreservationRequestSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { SubmitRecordPreservationAdapter } from "@system/infrastructure/adapters/records/submit-record-preservation.adapter"
import { RecordPreservationSubmissionError } from "@system/infrastructure/adapters/records/errors"

/** 会社カレンダー記録の取得と会社資格をSystemの共通提出処理へ接続する。 */
export function createCompanyCalendarDayPreservationSubmissionHandlers(
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
  return companyCalendarDayFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: companyCalendarDayIdSchema,
        number: z.coerce.number().int().positive().safe().optional(),
      }),
    ),
    zValidator("header", z.object({ "idempotency-key": z.uuid().optional() })),
    zValidator("json", schemas[mode]),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new CompanyCalendarDayForbiddenError()
      const request = c.req.valid("json")
      const companyCalendarDayId = c.req.valid("param").id
      const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
      const adapter = new SubmitRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "company-calendar",
          recordKind: "company-calendar-record",
          recordId: String(companyCalendarDayId),
          sourceNamespace,
          authorize: () => new CompanyCalendarDayActorReadAdapter(c).prepare(),
          capture: () =>
            new CaptureCompanyCalendarDayRecordAdapter(c).prepare({
              companyCalendarDayId,
              sourceNamespace,
            }),
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
            throw new CompanyCalendarDayInputError({ message: "invalid preservation request" })
          return adapter.execute({ ...common, revision: { mode: "create", idempotencyKey } })
        }
        const number = c.req.valid("param").number
        if (
          number === undefined ||
          !("previous_version" in request) ||
          !("previous_digest" in request)
        )
          throw new CompanyCalendarDayInputError({ message: "invalid preservation request" })
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
            throw new CompanyCalendarDayInputError({ message: submitted.message })
          case "forbidden":
            throw new CompanyCalendarDayForbiddenError()
          case "not_found":
            throw new CompanyCalendarDayNotFoundError()
          case "conflict":
            throw new CompanyCalendarDayConflictError()
          case "unavailable":
            throw new CompanyCalendarDayUnavailableError()
        }
      }
      return c.json(submitted.body, submitted.httpStatus)
    },
  )
}
