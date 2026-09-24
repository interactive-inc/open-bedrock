import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { itIncidentFactory } from "@/contexts/it-incident/interface/request-environment/it-incident-factory"
import { itIncidentIdSchema } from "@/contexts/it-incident/interface/http/it-incident-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordPreservation } from "@system/interface/operations/withdraw-system-record-preservation"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import {
  ItIncidentForbiddenError,
  ItIncidentInputError,
  ItIncidentNotFoundError,
  ItIncidentConflictError,
  ItIncidentUnavailableError,
} from "@/contexts/it-incident/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = itIncidentFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.strictObject({ id: itIncidentIdSchema, number: z.coerce.number().int().positive().safe() }),
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
    if (authentication === undefined) throw new ItIncidentForbiddenError()
    const result = await withdrawSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "it-incident",
          recordKind: "it-incident-record",
          recordId: String(c.req.valid("param").id),
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
          throw new ItIncidentInputError({ message: result.message })
        case "forbidden":
          throw new ItIncidentForbiddenError()
        case "not_found":
          throw new ItIncidentNotFoundError()
        case "conflict":
          throw new ItIncidentConflictError()
        case "unavailable":
          throw new ItIncidentUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
