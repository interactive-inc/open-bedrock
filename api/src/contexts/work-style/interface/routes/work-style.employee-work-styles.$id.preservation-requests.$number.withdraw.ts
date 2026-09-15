import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { employeeWorkStyleFactory } from "@/contexts/work-style/interface/request-environment/work-style-factory"
import { employeeWorkStyleIdSchema } from "@/contexts/work-style/interface/http/work-style-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  EmployeeWorkStyleForbiddenError,
  EmployeeWorkStyleInputError,
  EmployeeWorkStyleNotFoundError,
  EmployeeWorkStyleConflictError,
  EmployeeWorkStyleUnavailableError,
} from "@/contexts/work-style/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = employeeWorkStyleFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ id: employeeWorkStyleIdSchema, number: employeeWorkStyleIdSchema })),
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
    if (authentication === undefined) throw new EmployeeWorkStyleForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "work-style",
        recordKind: "employee-work-style-record",
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
          throw new EmployeeWorkStyleInputError({ message: result.message })
        case "forbidden":
          throw new EmployeeWorkStyleForbiddenError()
        case "not_found":
          throw new EmployeeWorkStyleNotFoundError()
        case "conflict":
          throw new EmployeeWorkStyleConflictError()
        case "unavailable":
          throw new EmployeeWorkStyleUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
