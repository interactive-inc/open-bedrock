import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { ForbiddenError } from "@/lib/errors"
import {
  AntisocialCheckRetirementForbiddenError,
  AntisocialCheckRetirementConflictError,
} from "@/contexts/antisocial-check/application/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"
import { VerifyAntisocialCheckRetirementPage } from "@/contexts/antisocial-check/application/verify-antisocial-check-retirement-page"
import { antisocialCheckRetirementVerificationCommandSchema } from "@/contexts/antisocial-check/domain/schemas/antisocial-check-retirement-verification-command.schema"
import { zAppAntisocialCheckRetirementVerificationReceipt } from "@/contexts/antisocial-check/interface/http/response-schemas"

// @authorization service - 人の再認証と管理権限、原記録の現在の閲覧権限を検査する
export const POST = antisocialCheckFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ planId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator("json", z.strictObject({})),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const stepUpToken = c.req.header("x-system-step-up")
    if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
    const command = antisocialCheckRetirementVerificationCommandSchema.safeParse({
      ...c.req.valid("json"),
      id: c.req.valid("header")["idempotency-key"],
      planId: c.req.valid("param").planId,
      sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE,
    })
    if (!command.success)
      throw new SystemHTTPException({
        status: 503,
        code: "record_retirement_unavailable",
        detail: "Record source configuration unavailable",
      })
    const receipt = await new VerifyAntisocialCheckRetirementPage(c).execute(
      command.data,
      stepUpToken,
    )
    if (
      receipt instanceof AntisocialCheckRetirementForbiddenError ||
      receipt instanceof ForbiddenError
    )
      throw new SystemForbiddenError()
    if (receipt instanceof AntisocialCheckRetirementConflictError)
      throw new SystemHTTPException({
        status: 409,
        code: "record_retirement_conflict",
        detail: "Retirement verification conflicts with the saved plan or previous operation",
      })
    if (receipt instanceof Error)
      throw new SystemHTTPException({
        status: 503,
        code: "record_retirement_unavailable",
        detail: "Retirement verification could not be completed",
      })
    return c.json(
      zAppAntisocialCheckRetirementVerificationReceipt.parse({
        id: receipt.snapshot.id,
        planId: receipt.snapshot.planId,
        planDigest: receipt.snapshot.planDigest,
        ordinal: receipt.snapshot.ordinal,
        digest: receipt.digest,
        coveragePageId: receipt.snapshot.coveragePageId,
        checkedAt: receipt.snapshot.checkedAt,
      }),
    )
  },
)
