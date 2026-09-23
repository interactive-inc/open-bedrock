import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { businessTripIdSchema } from "@/contexts/business-trip/interface/http/business-trip-input-schemas"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { DecideRecordPreservationAdapter } from "@system/infrastructure/adapters/records/decide-record-preservation.adapter"
import { RecordPreservationDecisionError } from "@system/infrastructure/adapters/records/errors"
import {
  BusinessTripForbiddenError,
  BusinessTripInputError,
  BusinessTripNotFoundError,
  BusinessTripConflictError,
  BusinessTripUnavailableError,
} from "@/contexts/business-trip/interface/errors"
/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createBusinessTripPreservationDecisionHandlers(action: "approve" | "reject") {
  return businessTripFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: businessTripIdSchema,
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
      if (authentication === undefined) throw new BusinessTripForbiddenError()
      const result = await new DecideRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "business-trip",
          recordKind: "business-trip-record",
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
            throw new BusinessTripInputError({ message: result.message })
          case "forbidden":
            throw new BusinessTripForbiddenError()
          case "not_found":
            throw new BusinessTripNotFoundError()
          case "conflict":
            throw new BusinessTripConflictError()
          case "unavailable":
            throw new BusinessTripUnavailableError()
        }
      }
      return c.json(result, 200)
    },
  )
}
