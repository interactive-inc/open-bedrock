import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { companyCalendarDayFactory } from "@/contexts/company-calendar/interface/request-environment/company-calendar-factory"
import { companyCalendarDayIdSchema } from "@/contexts/company-calendar/interface/http/company-calendar-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  CompanyCalendarDayForbiddenError,
  CompanyCalendarDayInputError,
  CompanyCalendarDayNotFoundError,
  CompanyCalendarDayConflictError,
  CompanyCalendarDayUnavailableError,
} from "@/contexts/company-calendar/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = companyCalendarDayFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: companyCalendarDayIdSchema, number: companyCalendarDayIdSchema })),
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
    if (authentication === undefined) throw new CompanyCalendarDayForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "company-calendar",
        recordKind: "company-calendar-record",
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
          throw new CompanyCalendarDayInputError({ message: result.message })
        case "forbidden":
          throw new CompanyCalendarDayForbiddenError()
        case "not_found":
          throw new CompanyCalendarDayNotFoundError()
        case "conflict":
          throw new CompanyCalendarDayConflictError()
        case "unavailable":
          throw new CompanyCalendarDayUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
