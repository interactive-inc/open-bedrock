import { DecideApplication } from "@/application/application/decide-application"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { UnauthorizedError } from "@/interface/lib/errors"
import { zAppApplicationDecision } from "@/lib/app-schemas"
import { z } from "zod"

export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      comment: z
        .string({
          required_error: "却下にはコメントが必須です",
          invalid_type_error: "却下にはコメントが必須です",
        })
        .min(1, "却下にはコメントが必須です")
        .max(3_000),
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
      action: "reject",
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
