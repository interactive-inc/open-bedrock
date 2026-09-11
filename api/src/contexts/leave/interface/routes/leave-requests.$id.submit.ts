import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { SubmitLeaveProcedure } from "@/contexts/leave/application/submit-leave-procedure"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { UnauthorizedError } from "@/lib/http/errors"

// @authorization service - 本人・提出権限・確認内容を保存時にも検査する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z
      .object({
        request_key: z.string().uuid(),
        confirmed_content_digest: z.string().regex(/^[a-f0-9]{64}$/),
        previous_leave_request_id: z.number().int().positive().safe().nullable(),
      })
      .strict(),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null || c.var.accountTokenVersion === null) throw new UnauthorizedError()
    const body = c.req.valid("json")
    const saved = await new SubmitLeaveProcedure(c).run({
      requestKey: body.request_key,
      leaveRequestId: validateIntParam(c.req.param("id"), "leave request"),
      previousLeaveRequestId: body.previous_leave_request_id,
      confirmedContentDigest: body.confirmed_content_digest,
      session,
      tokenVersion: c.var.accountTokenVersion,
      createdAt: new Date(c.env.NOW ?? Date.now()),
    })
    if (saved instanceof ApplicationError) throw toHttpException(saved)
    return c.json(
      { application_id: saved.binding.applicationId, replayed: saved.replayed },
      saved.replayed ? 200 : 201,
    )
  },
)
