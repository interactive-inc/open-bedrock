import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { onboardingFactory } from "@/contexts/onboarding/interface/request-environment/onboarding-factory"
import { onboardingRecordRouteSchema } from "@/contexts/onboarding/interface/http/onboarding-input-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { withdrawSystemRecordPreservation } from "@system/interface/operations/withdraw-system-record-preservation"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import {
  OnboardingForbiddenError,
  OnboardingInputError,
  OnboardingNotFoundError,
  OnboardingConflictError,
  OnboardingUnavailableError,
} from "@/contexts/onboarding/interface/errors"

// @authorization owner - 認証された申請者だけが指定した未完了提案を理由とともに取り下げる
export const POST = onboardingFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    onboardingRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
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
    if (authentication === undefined) throw new OnboardingForbiddenError()
    const result = await withdrawSystemRecordPreservation(
      {
        env: c.env,
        var: c.var,
        source: {
          ownerContext: "onboarding",
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
          throw new OnboardingInputError({ message: result.message })
        case "forbidden":
          throw new OnboardingForbiddenError()
        case "not_found":
          throw new OnboardingNotFoundError()
        case "conflict":
          throw new OnboardingConflictError()
        case "unavailable":
          throw new OnboardingUnavailableError()
      }
    }
    return c.json(result, 200)
  },
)
