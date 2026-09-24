import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { ringiFactory } from "@/contexts/ringi/interface/request-environment/ringi-factory"
import { ringiRecordRouteSchema } from "@/contexts/ringi/interface/http/ringi-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  RingiForbiddenError,
  RingiInputError,
  RingiNotFoundError,
  RingiConflictError,
  RingiUnavailableError,
} from "@/contexts/ringi/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = ringiFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    ringiRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
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
    if (authentication === undefined) throw new RingiForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "ringi",
        recordKind: c.req.valid("param").recordKind,
        recordId: c.req.valid("param").recordId,
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
          throw new RingiInputError({ message: result.message })
        case "forbidden":
          throw new RingiForbiddenError()
        case "not_found":
          throw new RingiNotFoundError()
        case "conflict":
          throw new RingiConflictError()
        case "unavailable":
          throw new RingiUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
