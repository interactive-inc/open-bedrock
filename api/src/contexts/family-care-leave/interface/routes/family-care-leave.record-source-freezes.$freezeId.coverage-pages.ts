import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { familyCareLeaveFactory } from "@/contexts/family-care-leave/interface/request-environment/family-care-leave-factory"
import { familyCareLeaveCoveragePageCommandSchema } from "@/contexts/family-care-leave/domain/schemas/family-care-leave-coverage-page-command.schema"
import { VerifyFamilyCareLeaveCoveragePage } from "@/contexts/family-care-leave/application/verify-family-care-leave-coverage-page"
import {
  FamilyCareLeaveCoverageForbiddenError,
  FamilyCareLeaveCoverageConflictError,
} from "@/contexts/family-care-leave/application/errors"
import { zAppFamilyCareLeaveCoveragePageReceipt } from "@/contexts/family-care-leave/interface/http/response-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"

// @authorization service - 人の再認証と管理権限に加え、原記録・保全本文の現在の閲覧権限を検査する
export const POST = familyCareLeaveFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ freezeId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator("json", familyCareLeaveCoveragePageCommandSchema.pick({ purpose: true, records: true })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const stepUpToken = c.req.header("x-system-step-up")
    if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
    const command = familyCareLeaveCoveragePageCommandSchema.safeParse({
      ...c.req.valid("json"),
      id: c.req.valid("header")["idempotency-key"],
      freezeId: c.req.valid("param").freezeId,
      sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE,
    })
    if (!command.success)
      throw new SystemHTTPException({
        status: 503,
        code: "record_coverage_unavailable",
        detail: "Record source configuration unavailable",
      })
    const receipt = await new VerifyFamilyCareLeaveCoveragePage(c).execute(command.data, stepUpToken)
    if (receipt instanceof FamilyCareLeaveCoverageForbiddenError) throw new SystemForbiddenError()
    if (receipt instanceof FamilyCareLeaveCoverageConflictError)
      throw new SystemHTTPException({
        status: 409,
        code: "record_coverage_conflict",
        detail: "Coverage page conflicts with the frozen source or previous operation",
      })
    if (receipt instanceof Error)
      throw new SystemHTTPException({
        status: 503,
        code: "record_coverage_unavailable",
        detail: "Coverage verification could not be completed",
      })
    return c.json(
      zAppFamilyCareLeaveCoveragePageReceipt.parse({
        id: receipt.snapshot.id,
        freezeId: receipt.snapshot.freezeId,
        sequence: receipt.snapshot.sequence,
        digest: receipt.digest,
        afterCursor: receipt.snapshot.afterCursor,
        nextCursor: receipt.snapshot.nextCursor,
        checkedAt: receipt.snapshot.checkedAt,
        recordCount: receipt.snapshot.records.length,
      }),
    )
  },
)
