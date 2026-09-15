import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { skillFactory } from "@/contexts/skill/interface/request-environment/skill-factory"
import { skillRecordRouteSchema } from "@/contexts/skill/interface/http/skill-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { WithdrawRecordPreservationAdapter } from "@system/infrastructure/adapters/records/withdraw-record-preservation.adapter"
import { RecordPreservationWithdrawalError } from "@system/infrastructure/adapters/records/errors"
import {
  SkillForbiddenError,
  SkillInputError,
  SkillNotFoundError,
  SkillConflictError,
  SkillUnavailableError,
} from "@/contexts/skill/interface/errors"
// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = skillFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", skillRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() })),
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
    if (authentication === undefined) throw new SkillForbiddenError()
    const result = await new WithdrawRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "skill",
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
          throw new SkillInputError({ message: result.message })
        case "forbidden":
          throw new SkillForbiddenError()
        case "not_found":
          throw new SkillNotFoundError()
        case "conflict":
          throw new SkillConflictError()
        case "unavailable":
          throw new SkillUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
