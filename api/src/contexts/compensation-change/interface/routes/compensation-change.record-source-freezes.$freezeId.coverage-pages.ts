import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { compensationChangeFactory } from "@/contexts/compensation-change/interface/request-environment/compensation-change-factory"
import { compensationChangeCoveragePageCommandSchema } from "@/contexts/compensation-change/domain/schemas/compensation-change-coverage-page-command.schema"
import { VerifyCompensationChangeCoveragePage } from "@/contexts/compensation-change/application/verify-compensation-change-coverage-page"
import {
  CompensationChangeCoverageForbiddenError,
  CompensationChangeCoverageConflictError,
} from "@/contexts/compensation-change/application/errors"
import { zAppCompensationChangeCoveragePageReceipt } from "@/contexts/compensation-change/interface/http/response-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"

// @authorization service - 人の再認証と管理権限に加え、原記録・保全本文の現在の閲覧権限を検査する
export const POST = compensationChangeFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ freezeId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator(
    "json",
    compensationChangeCoveragePageCommandSchema.pick({
      purpose: true,
      recordKind: true,
      records: true,
    }),
  ),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const stepUpToken = c.req.header("x-system-step-up")
    if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
    const command = compensationChangeCoveragePageCommandSchema.safeParse({
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
    const receipt = await new VerifyCompensationChangeCoveragePage(c).execute(
      command.data,
      stepUpToken,
    )
    if (receipt instanceof CompensationChangeCoverageForbiddenError)
      throw new SystemForbiddenError()
    if (receipt instanceof CompensationChangeCoverageConflictError)
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
      zAppCompensationChangeCoveragePageReceipt.parse({
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
