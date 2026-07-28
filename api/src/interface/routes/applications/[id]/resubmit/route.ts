import { ResubmitApplication } from "@/application/application/resubmit-application"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { jsonPayloadSchema } from "@/interface/utils/json-payload-schema"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ payload: jsonPayloadSchema(10_000) })),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()

    const result = await new ResubmitApplication(c).run({
      applicationId: validateIntParam(c.req.param("id"), "application"),
      applicantId: session.employeeId,
      payload: c.req.valid("json").payload,
      resubmittedAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof ApplicationError) throw toHttpException(result)

    return c.json(
      {
        id: result.id,
        status: result.status,
        current_step: result.currentStep,
        payload: result.payload,
      },
      200,
    )
  },
)
