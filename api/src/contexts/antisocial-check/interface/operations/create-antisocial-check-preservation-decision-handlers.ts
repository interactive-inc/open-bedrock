import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { antisocialCheckIdSchema } from "@/contexts/antisocial-check/interface/http/antisocial-check-input-schemas"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { decideSystemRecordPreservation } from "@system/interface/operations/decide-system-record-preservation"
import { RecordPreservationDecisionError } from "@system/application/records/errors"
import {
  AntisocialCheckForbiddenError,
  AntisocialCheckInputError,
  AntisocialCheckNotFoundError,
  AntisocialCheckConflictError,
  AntisocialCheckUnavailableError,
} from "@/contexts/antisocial-check/interface/errors"

/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createAntisocialCheckPreservationDecisionHandlers(action: "approve" | "reject") {
  return antisocialCheckFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: antisocialCheckIdSchema,
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
      if (authentication === undefined) throw new AntisocialCheckForbiddenError()
      const result = await decideSystemRecordPreservation(
        {
          env: c.env,
          var: c.var,
          source: {
            ownerContext: "antisocial-check",
            recordKind: "antisocial-check-record",
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
            throw new AntisocialCheckInputError({ message: result.message })
          case "forbidden":
            throw new AntisocialCheckForbiddenError()
          case "not_found":
            throw new AntisocialCheckNotFoundError()
          case "conflict":
            throw new AntisocialCheckConflictError()
          case "unavailable":
            throw new AntisocialCheckUnavailableError()
        }
      }
      return c.json(result, 200)
    },
  )
}
