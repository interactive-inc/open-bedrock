import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { trainingFactory } from "@/contexts/training/interface/request-environment/training-factory"
import { trainingRecordRouteSchema } from "@/contexts/training/interface/http/training-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { ReviewRecordPreservationAdapter } from "@system/infrastructure/adapters/records/review-record-preservation.adapter"
import { RecordPreservationReviewError } from "@system/infrastructure/adapters/records/errors"
import {
  TrainingForbiddenError,
  TrainingInputError,
  TrainingNotFoundError,
  TrainingConflictError,
  TrainingUnavailableError,
} from "@/contexts/training/interface/errors"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = trainingFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", trainingRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() })),
  zValidator(
    "query",
    z.strictObject({ include_original: z.enum(["true", "false"]).default("false") }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new TrainingForbiddenError()
    const result = await new ReviewRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "training",
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
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      includeOriginal: c.req.valid("query").include_original === "true",
    })
    if (result instanceof RecordPreservationReviewError) {
      switch (result.code) {
        case "invalid":
          throw new TrainingInputError({ message: result.message })
        case "forbidden":
          throw new TrainingForbiddenError()
        case "not_found":
          throw new TrainingNotFoundError()
        case "conflict":
          throw new TrainingConflictError()
        case "unavailable":
          throw new TrainingUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
