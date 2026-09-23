import { revalidateCompanyRecordPreservationExecution } from "@/contexts/company/interface/operations/revalidate-company-record-preservation-execution"
import { ExecuteRecordPreservationAdapter } from "@system/infrastructure/adapters/records/execute-record-preservation.adapter"
import { RecordPreservationExecutionError } from "@system/infrastructure/adapters/records/errors"
import {
  OnboardingForbiddenError,
  OnboardingInputError,
  OnboardingNotFoundError,
  OnboardingConflictError,
  OnboardingUnavailableError,
} from "@/contexts/onboarding/interface/errors"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { onboardingFactory } from "@/contexts/onboarding/interface/request-environment/onboarding-factory"
import { onboardingRecordRouteSchema } from "@/contexts/onboarding/interface/http/onboarding-input-schemas"
import { RevalidateOnboardingRecordSourceAdapter } from "@/contexts/onboarding/infrastructure/adapters/revalidate-onboarding-record-source.adapter"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"

// @authorization service - 承認済み内容、現在の保全権限、原記録、Company承認資格を再検査して一回だけ確定する
export const POST = onboardingFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    onboardingRecordRouteSchema.extend({ number: z.coerce.number().int().positive().safe() }),
  ),
  zValidator("json", z.strictObject({ proposal_digest: z.string().regex(/^[a-f0-9]{64}$/) })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const authentication = c.var.bearerReadAuthentication
    if (authentication === undefined) throw new OnboardingForbiddenError()
    const sourceNamespace = c.env.RECORD_SOURCE_NAMESPACE ?? ""
    const result = await new ExecuteRecordPreservationAdapter({
      env: c.env,
      var: c.var,
      source: {
        ownerContext: "onboarding",
        recordKind: c.req.valid("param").recordKind,
        recordId: c.req.valid("param").recordId,
        sourceNamespace,
        revalidate: (source) =>
          new RevalidateOnboardingRecordSourceAdapter({
            env: c.env,
            var: c.var,
            sourceNamespace,
          }).prepare(source),
      },
      prepareExecution: (input) => revalidateCompanyRecordPreservationExecution(c, input),
    }).execute({
      authentication,
      number: c.req.valid("param").number,
      proposalDigest: c.req.valid("json").proposal_digest,
    })
    if (result instanceof RecordPreservationExecutionError) {
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
