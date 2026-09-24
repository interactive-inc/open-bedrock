import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { companyCalendarDayFactory } from "@/contexts/company-calendar/interface/request-environment/company-calendar-factory"
import { companyCalendarDayIdSchema } from "@/contexts/company-calendar/interface/http/company-calendar-input-schemas"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { DecideRecordPreservationAdapter } from "@system/infrastructure/adapters/records/decide-record-preservation.adapter"
import { RecordPreservationDecisionError } from "@system/infrastructure/adapters/records/errors"
import {
  CompanyCalendarDayForbiddenError,
  CompanyCalendarDayInputError,
  CompanyCalendarDayNotFoundError,
  CompanyCalendarDayConflictError,
  CompanyCalendarDayUnavailableError,
} from "@/contexts/company-calendar/interface/errors"

/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createCompanyCalendarDayPreservationDecisionHandlers(action: "approve" | "reject") {
  return companyCalendarDayFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: companyCalendarDayIdSchema,
        number: z.coerce.number().int().positive().safe(),
      }),
    ),
    zValidator(
      "json",
      z.strictObject({
        decision_target: z.strictObject({
          proposal_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
          task_key: z.string().min(1).max(100),
          task_round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        }),
        comment: z.string().max(3000).nullable(),
      }),
    ),
    async (c) => {
      c.header("Cache-Control", "no-store")
      const authentication = c.var.bearerReadAuthentication
      if (authentication === undefined) throw new CompanyCalendarDayForbiddenError()
      const result = await new DecideRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "company-calendar",
          recordKind: "company-calendar-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
        },
        prepareDecision: async (input) => {
          const decision = await prepareCompanyRecordProcedureDecision(c, input)
          if (decision instanceof CompanyConflictError)
            return new RecordPreservationDecisionError("conflict")
          if (decision instanceof CompanyUnexpectedError)
            return new RecordPreservationDecisionError("unavailable")
          return decision
        },
      }).execute({
        authentication,
        number: c.req.valid("param").number,
        action,
        body: c.req.valid("json"),
      })
      if (result instanceof RecordPreservationDecisionError) {
        switch (result.code) {
          case "invalid":
            throw new CompanyCalendarDayInputError({ message: result.message })
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
      return c.json(result, 200)
    },
  )
}
