import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { disciplinaryActionIdSchema } from "@/contexts/disciplinary-action/interface/http/disciplinary-action-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  DisciplinaryActionForbiddenError,
  DisciplinaryActionInputError,
  DisciplinaryActionNotFoundError,
  DisciplinaryActionConflictError,
  DisciplinaryActionUnavailableError,
} from "@/contexts/disciplinary-action/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = disciplinaryActionFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      id: disciplinaryActionIdSchema,
      number: z.coerce.number().int().positive().safe(),
    }),
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
    if (authentication === undefined) throw new DisciplinaryActionForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "disciplinary-action",
        recordKind: "disciplinary-action-record",
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
          throw new DisciplinaryActionInputError({ message: result.message })
        case "forbidden":
          throw new DisciplinaryActionForbiddenError()
        case "not_found":
          throw new DisciplinaryActionNotFoundError()
        case "conflict":
          throw new DisciplinaryActionConflictError()
        case "unavailable":
          throw new DisciplinaryActionUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
