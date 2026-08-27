import { RejectRingi } from "@/contexts/ringi/application/reject-ringi"
import { NotifyApprovalResult } from "@/api/http/notifications/notify-approval-result"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppRingiDecision } from "@/lib/app-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/lib/http/errors"
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

    const updated = await new RejectRingi({
      context: c,
      notifyApprovalResult: (command) => new NotifyApprovalResult(c).run(command),
    }).execute({
      session: session,
      ringiId,
      approverId: session.employeeId,
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
