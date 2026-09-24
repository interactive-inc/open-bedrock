import { SystemForbiddenError, SystemHTTPException } from "@system/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { thanksFactory } from "@/contexts/thanks/interface/request-environment/thanks-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordRetirement } from "@system/interface/operations/withdraw-system-record-retirement"
import { RecordRetirementWithdrawalError } from "@system/application/records/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = thanksFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({
      planId: z.uuid(),
      number: z.coerce.number().int().positive().safe(),
    }),
  ),
  zValidator(
    "json",
    z.strictObject({
      proposal_version: z.number().int().positive().safe(),
      proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
      reason: z.string().trim().min(1).max(1000),
    }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new SystemForbiddenError()
    const result = await withdrawSystemRecordRetirement(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "thanks",
          planId: c.req.valid("param").planId,
          sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE ?? "",
        },
      },
      {
        authentication,
        number: c.req.valid("param").number,
        proposalVersion: c.req.valid("json").proposal_version,
        proposalDigest: c.req.valid("json").proposal_digest,
        reason: c.req.valid("json").reason,
      },
    )
    if (result instanceof RecordRetirementWithdrawalError) {
      const statuses: Readonly<
        Record<RecordRetirementWithdrawalError["code"], 400 | 403 | 404 | 409 | 503>
      > = { invalid: 400, forbidden: 403, not_found: 404, conflict: 409, unavailable: 503 }
      throw new SystemHTTPException({
        status: statuses[result.code],
        code: `record_retirement_${result.code}`,
        detail: result.message,
      })
    }
    return c.json(result, 200)
  },
)
