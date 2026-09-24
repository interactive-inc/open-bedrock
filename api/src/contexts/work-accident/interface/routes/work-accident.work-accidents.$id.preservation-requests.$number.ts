import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { workAccidentFactory } from "@/contexts/work-accident/interface/request-environment/work-accident-factory"
import { workAccidentIdSchema } from "@/contexts/work-accident/interface/http/work-accident-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { reviewSystemRecordPreservation } from "@system/interface/operations/review-system-record-preservation"
import { RecordPreservationReviewError } from "@system/application/records/errors"
import {
  WorkAccidentForbiddenError,
  WorkAccidentInputError,
  WorkAccidentNotFoundError,
  WorkAccidentConflictError,
  WorkAccidentUnavailableError,
} from "@/contexts/work-accident/interface/errors"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"

// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = workAccidentFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: workAccidentIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator(
    "query",
    z.strictObject({ include_original: z.enum(["true", "false"]).default("false") }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new WorkAccidentForbiddenError()
    const result = await reviewSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "work-accident",
          recordKind: "work-accident-record",
          recordId: String(c.req.valid("param").id),
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
          throw new WorkAccidentInputError({ message: result.message })
        case "forbidden":
          throw new WorkAccidentForbiddenError()
        case "not_found":
          throw new WorkAccidentNotFoundError()
        case "conflict":
          throw new WorkAccidentConflictError()
        case "unavailable":
          throw new WorkAccidentUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
