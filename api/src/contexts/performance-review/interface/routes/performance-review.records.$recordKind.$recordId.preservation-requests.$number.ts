import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { performanceReviewFactory } from "@/contexts/performance-review/interface/request-environment/performance-review-factory"
import { performanceReviewRecordRouteSchema } from "@/contexts/performance-review/interface/http/performance-review-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { reviewSystemRecordPreservation } from "@system/interface/operations/review-system-record-preservation"
import { RecordPreservationReviewError } from "@system/application/records/errors"
import {
  PerformanceReviewForbiddenError,
  PerformanceReviewInputError,
  PerformanceReviewNotFoundError,
  PerformanceReviewConflictError,
  PerformanceReviewUnavailableError,
} from "@/contexts/performance-review/interface/errors"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"

// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = performanceReviewFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    performanceReviewRecordRouteSchema.extend({
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator(
    "query",
    z.strictObject({ include_original: z.enum(["true", "false"]).default("false") }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new PerformanceReviewForbiddenError()
    const result = await reviewSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "performance-review",
          recordKind: c.req.valid("param").recordKind,
          recordId: c.req.valid("param").recordId,
          sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
        },
        prepareDecision: async (input) => {
          const decision = await prepareCompanyRecordProcedureDecision(c, input)
          if (decision instanceof CompanyConflictError)
            return new RecordPreservationReviewError("conflict")
          if (decision instanceof CompanyUnexpectedError)
            return new RecordPreservationReviewError("unavailable")
          return decision
        },
      },
      {
        authentication,
        number: c.req.valid("param").number,
        includeOriginal: c.req.valid("query").include_original === "true",
      },
    )
    if (result instanceof RecordPreservationReviewError) {
      switch (result.code) {
        case "invalid":
          throw new PerformanceReviewInputError({ message: result.message })
        case "forbidden":
          throw new PerformanceReviewForbiddenError()
        case "not_found":
          throw new PerformanceReviewNotFoundError()
        case "conflict":
          throw new PerformanceReviewConflictError()
        case "unavailable":
          throw new PerformanceReviewUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
