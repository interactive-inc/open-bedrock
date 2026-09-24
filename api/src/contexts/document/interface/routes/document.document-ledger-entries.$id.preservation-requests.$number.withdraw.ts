import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { documentFactory } from "@/contexts/document/interface/request-environment/document-factory"
import { documentIdSchema } from "@/contexts/document/interface/http/document-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordPreservation } from "@system/interface/operations/withdraw-system-record-preservation"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import {
  DocumentForbiddenError,
  DocumentInputError,
  DocumentNotFoundError,
  DocumentConflictError,
  DocumentUnavailableError,
} from "@/contexts/document/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = documentFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: documentIdSchema, number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator(
    "json",
    z.strictObject({
      proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string().trim().min(1).max(1000),
    }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new DocumentForbiddenError()
    const result = await withdrawSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "document",
          recordKind: "document-record",
          recordId: String(c.req.valid("param").id),
          sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
        },
      },
      {
        authentication,
        number: c.req.valid("param").number,
        proposalDigest: c.req.valid("json").proposal_digest,
        reason: c.req.valid("json").reason,
      },
    )
    if (result instanceof RecordPreservationWithdrawalError) {
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
