import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { oneOnOneFactory } from "@/contexts/one-on-one/interface/request-environment/one-on-one-factory"
import { ForbiddenError } from "@/lib/errors"
import { OneOnOneRetirementConflictError } from "@/contexts/one-on-one/application/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"
import { CreateOneOnOneRetirementPlan } from "@/contexts/one-on-one/application/create-one-on-one-retirement-plan"
import { oneOnOneRetirementPlanCommandSchema } from "@/contexts/one-on-one/domain/schemas/one-on-one-retirement-plan-command.schema"
import { zAppOneOnOneRetirementPlan } from "@/contexts/one-on-one/interface/http/response-schemas"

// @authorization service - 人の再認証と管理権限、原記録の現在の閲覧権限を検査する
export const POST = oneOnOneFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ freezeId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator("json", oneOnOneRetirementPlanCommandSchema.pick({ purpose: true })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const stepUpToken = c.req.header("x-system-step-up")
    if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
    const command = oneOnOneRetirementPlanCommandSchema.safeParse({
      ...c.req.valid("json"),
      id: c.req.valid("header")["idempotency-key"],
      freezeId: c.req.valid("param").freezeId,
      sourceNamespace: c.env.RECORD_SOURCE_NAMESPACE,
    })
    if (!command.success)
      throw new SystemHTTPException({
        status: 503,
        code: "record_retirement_unavailable",
        detail: "Record source configuration unavailable",
      })
    const receipt = await new CreateOneOnOneRetirementPlan(c).execute(command.data, stepUpToken)
    if (receipt instanceof ForbiddenError) throw new SystemForbiddenError()
    if (receipt instanceof OneOnOneRetirementConflictError)
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
      zAppOneOnOneRetirementPlan.parse({
        id: receipt.snapshot.id,
        freezeId: receipt.snapshot.freezeId,
        digest: receipt.digest,
        totalPages: receipt.totalPages,
        recordKinds: receipt.snapshot.capability.recordKinds,
        createdAt: receipt.snapshot.createdAt,
      }),
    )
  },
)
