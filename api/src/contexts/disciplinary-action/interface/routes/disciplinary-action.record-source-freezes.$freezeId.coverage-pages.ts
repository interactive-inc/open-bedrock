import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { disciplinaryActionFactory } from "@/contexts/disciplinary-action/interface/request-environment/disciplinary-action-factory"
import { disciplinaryActionCoveragePageCommandSchema } from "@/contexts/disciplinary-action/domain/schemas/disciplinary-action-coverage-page-command.schema"
import { VerifyDisciplinaryActionCoveragePage } from "@/contexts/disciplinary-action/application/verify-disciplinary-action-coverage-page"
import {
  DisciplinaryActionCoverageForbiddenError,
  DisciplinaryActionCoverageConflictError,
} from "@/contexts/disciplinary-action/application/errors"
import { zAppDisciplinaryActionCoveragePageReceipt } from "@/contexts/disciplinary-action/interface/http/response-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"

// @authorization service - 人の再認証と管理権限に加え、原記録・保全本文の現在の閲覧権限を検査する
export const POST = disciplinaryActionFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ freezeId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator(
    "json",
    disciplinaryActionCoveragePageCommandSchema.pick({ purpose: true, records: true }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const stepUpToken = c.req.header("x-system-step-up")
    if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
    const command = disciplinaryActionCoveragePageCommandSchema.safeParse({
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
    const receipt = await new VerifyDisciplinaryActionCoveragePage(c).execute(
      command.data,
      stepUpToken,
    )
    if (receipt instanceof DisciplinaryActionCoverageForbiddenError)
      throw new SystemForbiddenError()
    if (receipt instanceof DisciplinaryActionCoverageConflictError)
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
      zAppDisciplinaryActionCoveragePageReceipt.parse({
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
