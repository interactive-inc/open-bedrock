import { prepareCompanyRecordProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-record-procedure-decision"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { documentFactory } from "@/contexts/document/interface/request-environment/document-factory"
import { documentIdSchema } from "@/contexts/document/interface/http/document-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { reviewSystemRecordPreservation } from "@system/interface/operations/review-system-record-preservation"
import { RecordPreservationReviewError } from "@system/application/records/errors"
import {
  DocumentForbiddenError,
  DocumentInputError,
  DocumentNotFoundError,
  DocumentConflictError,
  DocumentUnavailableError,
} from "@/contexts/document/interface/errors"
import { CompanyConflictError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"

// @authorization service - 明示した提案閲覧権限と現在のCompany承認資格で判断対象を取得する
export const GET = documentFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: documentIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator(
    "query",
    z.strictObject({ include_original: z.enum(["true", "false"]).default("false") }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new DocumentForbiddenError()
    const result = await reviewSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "document",
          recordKind: "document-record",
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
          throw new DocumentInputError({ message: result.message })
        case "forbidden":
          throw new DocumentForbiddenError()
        case "not_found":
          throw new DocumentNotFoundError()
        case "conflict":
          throw new DocumentConflictError()
        case "unavailable":
          throw new DocumentUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
