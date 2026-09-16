import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { meetingFactory } from "@/contexts/meeting/interface/request-environment/meeting-factory"
import { ForbiddenError } from "@/lib/errors"
import { MeetingRetirementConflictError } from "@/contexts/meeting/application/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import {
  SystemForbiddenError,
  SystemHTTPException,
  SystemStepUpRequiredError,
} from "@system/interface/errors"
import { CreateMeetingRetirementPlan } from "@/contexts/meeting/application/create-meeting-retirement-plan"
import { meetingRetirementPlanCommandSchema } from "@/contexts/meeting/domain/schemas/meeting-retirement-plan-command.schema"
import { zAppMeetingRetirementPlan } from "@/contexts/meeting/interface/http/response-schemas"

// @authorization service - 人の再認証と管理権限、原記録の現在の閲覧権限を検査する
export const POST = meetingFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", z.strictObject({ freezeId: z.uuid() })),
  zValidator("header", z.object({ "idempotency-key": z.uuid() })),
  zValidator("json", meetingRetirementPlanCommandSchema.pick({ purpose: true })),
  async (c) => {
    c.header("Cache-Control", "no-store")
    const stepUpToken = c.req.header("x-system-step-up")
    if (stepUpToken === undefined) throw new SystemStepUpRequiredError()
    const command = meetingRetirementPlanCommandSchema.safeParse({
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
    const receipt = await new CreateMeetingRetirementPlan(c).execute(command.data, stepUpToken)
    if (receipt instanceof ForbiddenError) throw new SystemForbiddenError()
    if (receipt instanceof MeetingRetirementConflictError)
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
      zAppMeetingRetirementPlan.parse({
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
