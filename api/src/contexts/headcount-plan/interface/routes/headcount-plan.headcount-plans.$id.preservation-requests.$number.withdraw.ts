import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { headcountPlanFactory } from "@/contexts/headcount-plan/interface/request-environment/headcount-plan-factory"
import { headcountPlanIdSchema } from "@/contexts/headcount-plan/interface/http/headcount-plan-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  HeadcountPlanForbiddenError,
  HeadcountPlanInputError,
  HeadcountPlanNotFoundError,
  HeadcountPlanConflictError,
  HeadcountPlanUnavailableError,
} from "@/contexts/headcount-plan/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = headcountPlanFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: headcountPlanIdSchema, number: headcountPlanIdSchema })),
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
    if (authentication === undefined) throw new HeadcountPlanForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "headcount-plan",
        recordKind: "headcount-plan-record",
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
          throw new HeadcountPlanInputError({ message: result.message })
        case "forbidden":
          throw new HeadcountPlanForbiddenError()
        case "not_found":
          throw new HeadcountPlanNotFoundError()
        case "conflict":
          throw new HeadcountPlanConflictError()
        case "unavailable":
          throw new HeadcountPlanUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
