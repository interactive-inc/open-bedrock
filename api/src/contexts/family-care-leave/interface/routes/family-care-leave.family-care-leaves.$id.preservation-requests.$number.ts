import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { familyCareLeaveFactory } from "@/contexts/family-care-leave/interface/request-environment/family-care-leave-factory"
import { familyCareLeaveIdSchema } from "@/contexts/family-care-leave/interface/http/family-care-leave-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { reviewSystemRecordPreservation } from "@system/interface/operations/review-system-record-preservation"
import { RecordPreservationReviewError } from "@system/application/records/errors"
import {
  FamilyCareLeaveForbiddenError,
  FamilyCareLeaveInputError,
  FamilyCareLeaveNotFoundError,
  FamilyCareLeaveConflictError,
  FamilyCareLeaveUnavailableError,
} from "@/contexts/family-care-leave/interface/errors"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"

// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = familyCareLeaveFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: familyCareLeaveIdSchema,
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
    if (authentication === undefined) throw new FamilyCareLeaveForbiddenError()
    const result = await reviewSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "family-care-leave",
          recordKind: "family-care-leave-record",
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
          throw new FamilyCareLeaveInputError({ message: result.message })
        case "forbidden":
          throw new FamilyCareLeaveForbiddenError()
        case "not_found":
          throw new FamilyCareLeaveNotFoundError()
        case "conflict":
          throw new FamilyCareLeaveConflictError()
        case "unavailable":
          throw new FamilyCareLeaveUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
