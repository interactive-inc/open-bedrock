import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { governanceRecordFactory } from "@/contexts/governance/interface/request-environment/governance-record-factory"
import { governanceRecordRouteSchema } from "@/contexts/governance/interface/http/governance-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordPreservation } from "@system/interface/operations/withdraw-system-record-preservation"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import {
  GovernanceForbiddenError,
  GovernanceInputError,
  GovernanceNotFoundError,
  GovernanceConflictError,
  GovernanceUnavailableError,
} from "@/contexts/governance/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = governanceRecordFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    governanceRecordRouteSchema.extend({
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
    if (authentication === undefined) throw new GovernanceForbiddenError()
    const result = await withdrawSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "governance",
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
          throw new GovernanceInputError({ message: result.message })
        case "forbidden":
          throw new GovernanceForbiddenError()
        case "not_found":
          throw new GovernanceNotFoundError()
        case "conflict":
          throw new GovernanceConflictError()
        case "unavailable":
          throw new GovernanceUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
