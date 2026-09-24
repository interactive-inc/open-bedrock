import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { commendationFactory } from "@/contexts/commendation/interface/request-environment/commendation-factory"
import { commendationIdSchema } from "@/contexts/commendation/interface/http/commendation-input-schemas"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { decideSystemRecordPreservation } from "@system/interface/operations/decide-system-record-preservation"
import { RecordPreservationDecisionError } from "@system/application/records/errors"
import {
  CommendationForbiddenError,
  CommendationInputError,
  CommendationNotFoundError,
  CommendationConflictError,
  CommendationUnavailableError,
} from "@/contexts/commendation/interface/errors"

/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createCommendationPreservationDecisionHandlers(action: "approve" | "reject") {
  return commendationFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: commendationIdSchema,
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
      if (authentication === undefined) throw new CommendationForbiddenError()
      const result = await decideSystemRecordPreservation(
        {
          env: c.env,
          var: c.var,
          source: {
            ownerContext: "commendation",
            recordKind: "commendation-record",
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
        },
        {
          authentication,
          number: c.req.valid("param").number,
          action,
          body: c.req.valid("json"),
        },
      )
      if (result instanceof RecordPreservationDecisionError) {
        switch (result.code) {
          case "invalid":
            throw new CommendationInputError({ message: result.message })
          case "forbidden":
            throw new CommendationForbiddenError()
          case "not_found":
            throw new CommendationNotFoundError()
          case "conflict":
            throw new CommendationConflictError()
          case "unavailable":
            throw new CommendationUnavailableError()
        }
      }
      return c.json(result, 200)
    },
  )
}
