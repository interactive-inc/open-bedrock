import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { careerFactory } from "@/contexts/career/interface/request-environment/career-factory"
import { careerRecordRouteSchema } from "@/contexts/career/interface/http/career-input-schemas"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { decideSystemRecordPreservation } from "@system/interface/operations/decide-system-record-preservation"
import { RecordPreservationDecisionError } from "@system/application/records/errors"
import {
  CareerForbiddenError,
  CareerInputError,
  CareerNotFoundError,
  CareerConflictError,
  CareerUnavailableError,
} from "@/contexts/career/interface/errors"

/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createCareerPreservationDecisionHandlers(action: "approve" | "reject") {
  return careerFactory.createHandlers(
    zValidator(
      "param",
      careerRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
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
      if (authentication === undefined) throw new CareerForbiddenError()
      const result = await decideSystemRecordPreservation(
        {
          env: c.env,
          var: c.var,
          source: {
            ownerContext: "career",
            recordKind: c.req.valid("param").recordKind,
            recordId: c.req.valid("param").recordId,
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
            throw new CareerInputError({ message: result.message })
          case "forbidden":
            throw new CareerForbiddenError()
          case "not_found":
            throw new CareerNotFoundError()
          case "conflict":
            throw new CareerConflictError()
          case "unavailable":
            throw new CareerUnavailableError()
        }
      }
      return c.json(result, 200)
    },
  )
}
