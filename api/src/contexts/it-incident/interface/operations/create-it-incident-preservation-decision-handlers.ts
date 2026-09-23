import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { itIncidentFactory } from "@/contexts/it-incident/interface/request-environment/it-incident-factory"
import { itIncidentIdSchema } from "@/contexts/it-incident/interface/http/it-incident-input-schemas"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { DecideRecordPreservationAdapter } from "@system/infrastructure/adapters/records/decide-record-preservation.adapter"
import { RecordPreservationDecisionError } from "@system/infrastructure/adapters/records/errors"
import {
  ItIncidentForbiddenError,
  ItIncidentInputError,
  ItIncidentNotFoundError,
  ItIncidentConflictError,
  ItIncidentUnavailableError,
} from "@/contexts/it-incident/interface/errors"
/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createItIncidentPreservationDecisionHandlers(action: "approve" | "reject") {
  return itIncidentFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: itIncidentIdSchema, number: z.coerce.number().int().positive().safe() }),
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
      if (authentication === undefined) throw new ItIncidentForbiddenError()
      const result = await new DecideRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "it-incident",
          recordKind: "it-incident-record",
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
            throw new ItIncidentInputError({ message: result.message })
          case "forbidden":
            throw new ItIncidentForbiddenError()
          case "not_found":
            throw new ItIncidentNotFoundError()
          case "conflict":
            throw new ItIncidentConflictError()
          case "unavailable":
            throw new ItIncidentUnavailableError()
        }
      }
      return c.json(result, 200)
    },
  )
}
