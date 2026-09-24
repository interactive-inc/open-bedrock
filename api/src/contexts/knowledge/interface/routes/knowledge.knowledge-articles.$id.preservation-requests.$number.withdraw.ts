import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { knowledgeFactory } from "@/contexts/knowledge/interface/request-environment/knowledge-factory"
import { knowledgeIdSchema } from "@/contexts/knowledge/interface/http/knowledge-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordPreservation } from "@system/interface/operations/withdraw-system-record-preservation"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import {
  KnowledgeForbiddenError,
  KnowledgeInputError,
  KnowledgeNotFoundError,
  KnowledgeConflictError,
  KnowledgeUnavailableError,
} from "@/contexts/knowledge/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = knowledgeFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: knowledgeIdSchema, number: z.coerce.number().int().positive().safe() }),
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
    if (authentication === undefined) throw new KnowledgeForbiddenError()
    const result = await withdrawSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "knowledge",
          recordKind: "knowledge-article-record",
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
          throw new KnowledgeInputError({ message: result.message })
        case "forbidden":
          throw new KnowledgeForbiddenError()
        case "not_found":
          throw new KnowledgeNotFoundError()
        case "conflict":
          throw new KnowledgeConflictError()
        case "unavailable":
          throw new KnowledgeUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
