import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { compensationChangeFactory } from "@/contexts/compensation-change/interface/request-environment/compensation-change-factory"
import { compensationChangeRecordRouteSchema } from "@/contexts/compensation-change/interface/http/compensation-change-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { ReviewRecordPreservationAdapter } from "@system/infrastructure/adapters/records/review-record-preservation.adapter"
import { RecordPreservationReviewError } from "@system/infrastructure/adapters/records/errors"
import {
  CompensationChangeForbiddenError,
  CompensationChangeInputError,
  CompensationChangeNotFoundError,
  CompensationChangeConflictError,
  CompensationChangeUnavailableError,
} from "@/contexts/compensation-change/interface/errors"
import { PrepareCompanyRecordProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-procedure-decision.adapter"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = compensationChangeFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", compensationChangeRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() })),
  zValidator(
    "query",
    z.strictObject({ include_original: z.enum(["true", "false"]).default("false") }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new CompensationChangeForbiddenError()
    const result = await new ReviewRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "compensation-change",
        recordKind: c.req.valid("param").recordKind,
        recordId: c.req.valid("param").recordId,
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
          throw new CompensationChangeInputError({ message: result.message })
        case "forbidden":
          throw new CompensationChangeForbiddenError()
        case "not_found":
          throw new CompensationChangeNotFoundError()
        case "conflict":
          throw new CompensationChangeConflictError()
        case "unavailable":
          throw new CompensationChangeUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
