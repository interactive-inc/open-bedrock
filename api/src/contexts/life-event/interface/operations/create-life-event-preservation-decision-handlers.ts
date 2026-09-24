import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { lifeEventFactory } from "@/contexts/life-event/interface/request-environment/life-event-factory"
import { lifeEventIdSchema } from "@/contexts/life-event/interface/http/life-event-input-schemas"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { DecideRecordPreservationAdapter } from "@system/infrastructure/adapters/records/decide-record-preservation.adapter"
import { RecordPreservationDecisionError } from "@system/infrastructure/adapters/records/errors"
import {
  LifeEventForbiddenError,
  LifeEventInputError,
  LifeEventNotFoundError,
  LifeEventConflictError,
  LifeEventUnavailableError,
} from "@/contexts/life-event/interface/errors"

/** 保全の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createLifeEventPreservationDecisionHandlers(action: "approve" | "reject") {
  return lifeEventFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({ id: lifeEventIdSchema, number: z.coerce.number().int().positive().safe() }),
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
      if (authentication === undefined) throw new LifeEventForbiddenError()
      const result = await new DecideRecordPreservationAdapter({
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "life-event",
          recordKind: "life-event-record",
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
            throw new LifeEventInputError({ message: result.message })
          case "forbidden":
            throw new LifeEventForbiddenError()
          case "not_found":
            throw new LifeEventNotFoundError()
          case "conflict":
            throw new LifeEventConflictError()
          case "unavailable":
            throw new LifeEventUnavailableError()
        }
      }
      return c.json(result, 200)
    },
  )
}
