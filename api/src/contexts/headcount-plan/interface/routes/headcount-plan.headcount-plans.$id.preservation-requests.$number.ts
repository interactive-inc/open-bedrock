import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { headcountPlanFactory } from "@/contexts/headcount-plan/interface/request-environment/headcount-plan-factory"
import { headcountPlanIdSchema } from "@/contexts/headcount-plan/interface/http/headcount-plan-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { ReviewRecordPreservationAdapter } from "@system/infrastructure/adapters/records/review-record-preservation.adapter"
import { RecordPreservationReviewError } from "@system/infrastructure/adapters/records/errors"
import {
  HeadcountPlanForbiddenError,
  HeadcountPlanInputError,
  HeadcountPlanNotFoundError,
  HeadcountPlanConflictError,
  HeadcountPlanUnavailableError,
} from "@/contexts/headcount-plan/interface/errors"
import { PrepareCompanyRecordProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-decision.adapter"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = headcountPlanFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: headcountPlanIdSchema, number: headcountPlanIdSchema })),
  zValidator(
    "query",
    z.strictObject({ include_original: z.enum(["true", "false"]).default("false") }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new HeadcountPlanForbiddenError()
    const result = await new ReviewRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "headcount-plan",
        recordKind: "headcount-plan-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
      },
      prepareDecision: async (input) => {
        const decision = await new PrepareCompanyRecordProcedureDecisionAdapter(c).prepare(input)
        if (decision instanceof CompanyConflictError)
          return new RecordPreservationReviewError("conflict")
        if (decision instanceof CompanyUnexpectedError)
          return new RecordPreservationReviewError("unavailable")
        return decision
      },
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      includeOriginal: c.req.valid("query").include_original === "true",
    })
    if (result instanceof RecordPreservationReviewError) {
      switch (result.code) {
        case "invalid":
          throw new HeadcountPlanInputError({ message: result.message })
        case "forbidden":
          throw new HeadcountPlanForbiddenError()
        case "not_found":
          throw new HeadcountPlanNotFoundError()
        case "conflict":
          throw new HeadcountPlanConflictError()
        case "unavailable":
          throw new HeadcountPlanUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
