import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { thanksFactory } from "@/contexts/thanks/interface/request-environment/thanks-factory"
import { thanksRecordRouteSchema } from "@/contexts/thanks/interface/http/thanks-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  ThanksForbiddenError,
  ThanksInputError,
  ThanksNotFoundError,
  ThanksConflictError,
  ThanksUnavailableError,
} from "@/contexts/thanks/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = thanksFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    thanksRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
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
    if (authentication === undefined) throw new ThanksForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "thanks",
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
          throw new ThanksInputError({ message: result.message })
        case "forbidden":
          throw new ThanksForbiddenError()
        case "not_found":
          throw new ThanksNotFoundError()
        case "conflict":
          throw new ThanksConflictError()
        case "unavailable":
          throw new ThanksUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
