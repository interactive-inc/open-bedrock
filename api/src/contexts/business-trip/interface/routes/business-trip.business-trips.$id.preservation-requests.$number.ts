import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { businessTripFactory } from "@/contexts/business-trip/interface/request-environment/business-trip-factory"
import { businessTripIdSchema } from "@/contexts/business-trip/interface/http/business-trip-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { ReviewRecordPreservationAdapter } from "@system/infrastructure/adapters/records/review-record-preservation.adapter"
import { RecordPreservationReviewError } from "@system/infrastructure/adapters/records/errors"
import {
  BusinessTripForbiddenError,
  BusinessTripInputError,
  BusinessTripNotFoundError,
  BusinessTripConflictError,
  BusinessTripUnavailableError,
} from "@/contexts/business-trip/interface/errors"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = businessTripFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: businessTripIdSchema, number: z.coerce.number().int().positive().safe() })),
  zValidator(
    "query",
    z.strictObject({ include_original: z.enum(["true", "false"]).default("false") }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new BusinessTripForbiddenError()
    const result = await new ReviewRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "business-trip",
        recordKind: "business-trip-record",
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
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      includeOriginal: c.req.valid("query").include_original === "true",
    })
    if (result instanceof RecordPreservationReviewError) {
      switch (result.code) {
        case "invalid":
          throw new BusinessTripInputError({ message: result.message })
        case "forbidden":
          throw new BusinessTripForbiddenError()
        case "not_found":
          throw new BusinessTripNotFoundError()
        case "conflict":
          throw new BusinessTripConflictError()
        case "unavailable":
          throw new BusinessTripUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
