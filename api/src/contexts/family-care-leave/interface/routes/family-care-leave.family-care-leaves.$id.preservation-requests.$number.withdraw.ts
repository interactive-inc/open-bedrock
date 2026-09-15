import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { familyCareLeaveFactory } from "@/contexts/family-care-leave/interface/request-environment/family-care-leave-factory"
import { familyCareLeaveIdSchema } from "@/contexts/family-care-leave/interface/http/family-care-leave-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  FamilyCareLeaveForbiddenError,
  FamilyCareLeaveInputError,
  FamilyCareLeaveNotFoundError,
  FamilyCareLeaveConflictError,
  FamilyCareLeaveUnavailableError,
} from "@/contexts/family-care-leave/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = familyCareLeaveFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: familyCareLeaveIdSchema, number: z.coerce.number().int().positive().safe() })),
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
    if (authentication === undefined) throw new FamilyCareLeaveForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "family-care-leave",
        recordKind: "family-care-leave-record",
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
          throw new FamilyCareLeaveInputError({ message: result.message })
        case "forbidden":
          throw new FamilyCareLeaveForbiddenError()
        case "not_found":
          throw new FamilyCareLeaveNotFoundError()
        case "conflict":
          throw new FamilyCareLeaveConflictError()
        case "unavailable":
          throw new FamilyCareLeaveUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
