import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { antisocialCheckFactory } from "@/contexts/antisocial-check/interface/request-environment/antisocial-check-factory"
import { antisocialCheckCoveragePageCommandSchema } from "@/contexts/antisocial-check/domain/schemas/antisocial-check-coverage-page-command.schema"
import { VerifyAntisocialCheckCoveragePage } from "@/contexts/antisocial-check/application/verify-antisocial-check-coverage-page"
import {
  AntisocialCheckCoverageForbiddenError,
  AntisocialCheckCoverageConflictError,
} from "@/contexts/antisocial-check/application/errors"
import { zAppAntisocialCheckCoveragePageReceipt } from "@/contexts/antisocial-check/interface/http/response-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"

// @authorization service - 人の再認証と管理権限に加え、原記録・保全本文の現在の閲覧権限を検査する
export const POST = antisocialCheckFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ freezeId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator(
    "json",
    antisocialCheckCoveragePageCommandSchema.pick({ purpose: true, records: true }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const stepUpToken = c.req.header("x-system-step-up")
    if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
    const command = antisocialCheckCoveragePageCommandSchema.safeParse({
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
    const receipt = await new VerifyAntisocialCheckCoveragePage(c).execute(
      command.data,
      stepUpToken,
    )
    if (receipt instanceof AntisocialCheckCoverageForbiddenError) throw new SystemForbiddenError()
    if (receipt instanceof AntisocialCheckCoverageConflictError)
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
      zAppAntisocialCheckCoveragePageReceipt.parse({
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
