import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { disciplinaryActionIdSchema } from "@/contexts/disciplinary-action/interface/http/disciplinary-action-input-schemas"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { DecideRecordPreservationAdapter } from "@system/infrastructure/adapters/records/decide-record-preservation.adapter"
import { RecordPreservationDecisionError } from "@system/infrastructure/adapters/records/errors"
import {
  DisciplinaryActionForbiddenError,
  DisciplinaryActionInputError,
  DisciplinaryActionNotFoundError,
  DisciplinaryActionConflictError,
  DisciplinaryActionUnavailableError,
} from "@/contexts/disciplinary-action/interface/errors"
/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createDisciplinaryActionPreservationDecisionHandlers(action: "approve" | "reject") {
  return disciplinaryActionFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        id: disciplinaryActionIdSchema,
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
      if (authentication === undefined) throw new DisciplinaryActionForbiddenError()
      const result = await new DecideRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "disciplinary-action",
          recordKind: "disciplinary-action-record",
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
            throw new DisciplinaryActionInputError({ message: result.message })
          case "forbidden":
            throw new DisciplinaryActionForbiddenError()
          case "not_found":
            throw new DisciplinaryActionNotFoundError()
          case "conflict":
            throw new DisciplinaryActionConflictError()
          case "unavailable":
            throw new DisciplinaryActionUnavailableError()
        }
      }
      return c.json(result, 200)
    },
  )
}
