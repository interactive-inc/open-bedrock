import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { trainingFactory } from "@/contexts/training/interface/request-environment/training-factory"
import { trainingRecordRouteSchema } from "@/contexts/training/interface/http/training-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordPreservation } from "@system/interface/operations/withdraw-system-record-preservation"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import {
  TrainingForbiddenError,
  TrainingInputError,
  TrainingNotFoundError,
  TrainingConflictError,
  TrainingUnavailableError,
} from "@/contexts/training/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = trainingFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    trainingRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
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
    if (authentication === undefined) throw new TrainingForbiddenError()
    const result = await withdrawSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "training",
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
          throw new TrainingInputError({ message: result.message })
        case "forbidden":
          throw new TrainingForbiddenError()
        case "not_found":
          throw new TrainingNotFoundError()
        case "conflict":
          throw new TrainingConflictError()
        case "unavailable":
          throw new TrainingUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
