import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { announcementFactory } from "@/contexts/announcement/interface/request-environment/announcement-factory"
import { announcementIdSchema } from "@/contexts/announcement/interface/http/announcement-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  AnnouncementForbiddenError,
  AnnouncementInputError,
  AnnouncementNotFoundError,
  AnnouncementConflictError,
  AnnouncementUnavailableError,
} from "@/contexts/announcement/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = announcementFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: announcementIdSchema, number: z.coerce.number().int().positive().safe() }),
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
    if (authentication === undefined) throw new AnnouncementForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "announcement",
        recordKind: "announcement-record",
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
          throw new AnnouncementInputError({ message: result.message })
        case "forbidden":
          throw new AnnouncementForbiddenError()
        case "not_found":
          throw new AnnouncementNotFoundError()
        case "conflict":
          throw new AnnouncementConflictError()
        case "unavailable":
          throw new AnnouncementUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
