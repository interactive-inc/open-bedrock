import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { meetingFactory } from "@/contexts/meeting/interface/request-environment/meeting-factory"
import { meetingRecordRouteSchema } from "@/contexts/meeting/interface/http/meeting-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordPreservation } from "@system/interface/operations/withdraw-system-record-preservation"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import {
  MeetingForbiddenError,
  MeetingInputError,
  MeetingNotFoundError,
  MeetingConflictError,
  MeetingUnavailableError,
} from "@/contexts/meeting/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = meetingFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    meetingRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
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
    if (authentication === undefined) throw new MeetingForbiddenError()
    const result = await withdrawSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "meeting",
          recordKind: c.req.valid("param").recordKind,
          recordId: c.req.valid("param").recordId,
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
          throw new MeetingInputError({ message: result.message })
        case "forbidden":
          throw new MeetingForbiddenError()
        case "not_found":
          throw new MeetingNotFoundError()
        case "conflict":
          throw new MeetingConflictError()
        case "unavailable":
          throw new MeetingUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
