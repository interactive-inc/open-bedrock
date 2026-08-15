import { ResubmitApplication } from "@/contexts/request/application/resubmit-application"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { jsonPayloadSchema } from "@/contexts/company/interface/utils/json-payload-schema"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
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
