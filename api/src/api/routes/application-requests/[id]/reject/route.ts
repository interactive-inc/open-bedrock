import { decideSystemApplication } from "@/api/routes/application-requests/lib/system-application-operation"
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

    const updated = await decideSystemApplication(c, {
      number: applicationId,
      actorEmployeeId: session.employeeId,
      action: "reject",
      comment: body.comment,
      decidedAt: new Date(c.env.NOW ?? Date.now()),
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppApplicationDecision.parse({ status: updated.status })

    return c.json(responseBody, 200)
  },
)
