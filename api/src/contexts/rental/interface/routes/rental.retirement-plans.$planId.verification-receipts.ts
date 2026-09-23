import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { rentalReservationFactory } from "@/contexts/rental/interface/request-environment/rental-factory"
import { ForbiddenError } from "@/lib/errors"
import {
  RentalReservationRetirementForbiddenError,
  RentalReservationRetirementConflictError,
} from "@/contexts/rental/application/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"
import { VerifyRentalReservationRetirementPage } from "@/contexts/rental/application/verify-rental-reservation-retirement-page"
import { rentalReservationRetirementVerificationCommandSchema } from "@/contexts/rental/domain/schemas/rental-retirement-verification-command.schema"
import { zAppRentalReservationRetirementVerificationReceipt } from "@/contexts/rental/interface/http/response-schemas"

// @authorization service - 人の再認証と管理権限、原記録の現在の閲覧権限を検査する
export const POST = rentalReservationFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ planId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator("json", z.strictObject({})),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const stepUpToken = c.req.header("x-system-step-up")
    if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
    const command = rentalReservationRetirementVerificationCommandSchema.safeParse({
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
    const receipt = await new VerifyRentalReservationRetirementPage(c).execute(
      command.data,
      stepUpToken,
    )
    if (
      receipt instanceof RentalReservationRetirementForbiddenError ||
      receipt instanceof ForbiddenError
    )
      throw new SystemForbiddenError()
    if (receipt instanceof RentalReservationRetirementConflictError)
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
      zAppRentalReservationRetirementVerificationReceipt.parse({
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
