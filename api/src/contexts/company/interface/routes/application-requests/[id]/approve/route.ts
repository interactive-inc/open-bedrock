import { DecideApplication } from "@/contexts/company/application/application/decide-application"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppApplicationDecision } from "@/lib/app-schemas"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      comment: z.string().max(3_000).nullable(),
    }),
  ),
  async (c) => {
    const applicationId = validateIntParam(c.req.param("id"), "application")

    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const updated = await new DecideApplication(c).run({
      session: session,
      applicationId: applicationId,
      approverId: session.employeeId,
      action: "approve",
      comment: body.comment,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppApplicationDecision.parse({ status: updated.status })

    return c.json(responseBody, 200)
  },
)
