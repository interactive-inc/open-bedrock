import { DecideRingi } from "@/contexts/ringi/application/decide-ringi"
import { factory } from "@/contexts/company/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppRingiDecision } from "@/lib/app-schemas"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
/** POST /ringi-requests/:id/reject — 稟議を却下する（指名された承認者本人のみ。コメント任意） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      comment: z.string().max(3_000).nullable().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const ringiId = validateIntParam(c.req.param("id"), "ringi")

    const body = c.req.valid("json")

    const updated = await new DecideRingi(c).run({
      session: session,
      ringiId,
      approverId: session.employeeId,
      action: "reject",
      comment: body.comment ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppRingiDecision.parse({ status: updated.status })

    return c.json(responseBody, 200)
  },
)
