import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { resignationFactory } from "@/contexts/resignation/interface/request-environment/resignation-factory"
import { resignationIdSchema } from "@/contexts/resignation/interface/http/resignation-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  ResignationForbiddenError,
  ResignationInputError,
  ResignationNotFoundError,
  ResignationConflictError,
  ResignationUnavailableError,
} from "@/contexts/resignation/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = resignationFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: resignationIdSchema, number: z.coerce.number().int().positive().safe() })),
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
    if (authentication === undefined) throw new ResignationForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "resignation",
        recordKind: "resignation-record",
        recordId: String(c.req.valid("param").id),
        sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
      },
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
      reason: c.req.valid("json").reason,
    })
    if (result instanceof RecordPreservationWithdrawalError) {
      switch (result.code) {
        case "invalid":
          throw new ResignationInputError({ message: result.message })
        case "forbidden":
          throw new ResignationForbiddenError()
        case "not_found":
          throw new ResignationNotFoundError()
        case "conflict":
          throw new ResignationConflictError()
        case "unavailable":
          throw new ResignationUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
