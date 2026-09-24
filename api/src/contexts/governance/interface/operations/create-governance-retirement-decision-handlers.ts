import { prepareCompanyRecordDecisionReplay } from "@/contexts/company/interface/operations/prepare-company-record-decision-replay"
import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { governanceRecordFactory } from "@/contexts/governance/interface/request-environment/governance-record-factory"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import { decideSystemRecordRetirement } from "@system/interface/operations/decide-system-record-retirement"
import { RecordRetirementDecisionError } from "@system/application/records/errors"
import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"

/** 撤去の肯定・否定判断に同じ認証、会社資格、対象照合を適用する。 */
export function createGovernanceRetirementDecisionHandlers(action: "approve" | "reject") {
  return governanceRecordFactory.createHandlers(
    zValidator(
      "param",
      z.strictObject({
        planId: z.uuid(),
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
      if (authentication === undefined) throw new SystemForbiddenError()
      const result = await decideSystemRecordRetirement(
        {
          env: c.env,
          var: c.var,
          source: {
            ownerContext: "governance",
            planId: c.req.valid("param").planId,
            sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
          },
          prepareReplay: (input) => prepareCompanyRecordDecisionReplay(c, input),
          prepareDecision: async (input) => {
            const decision = await prepareCompanyRecordProcedureDecision(c, input)
            if (decision instanceof CompanyConflictError)
              return new RecordRetirementDecisionError("conflict")
            if (decision instanceof CompanyUnexpectedError)
              return new RecordRetirementDecisionError("unavailable")
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
      if (result instanceof RecordRetirementDecisionError) {
        const statuses: Readonly<
          Record<RecordRetirementDecisionError["code"], 400 | 403 | 404 | 409 | 503>
        > = { invalid: 400, forbidden: 403, not_found: 404, conflict: 409, unavailable: 503 }
        throw new SystemHTTPException({
          status: statuses[result.code],
          code: `record_retirement_${result.code}`,
          detail: result.message,
        })
      }
      return c.json(result, 200)
    },
  )
}
