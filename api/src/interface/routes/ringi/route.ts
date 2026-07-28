import { SubmitRingi } from "@/application/ringi/submit-ringi"
import { factory } from "@/interface/utils/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppRingi } from "@/lib/app-schemas"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/interface/lib/errors"
import { z } from "zod"

/** POST /ringi — 稟議を起案する（全認証者。承認者を 1 名指定する） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      approver_id: z.number().int().positive().safe(),
      title: z.string().min(1).max(200),
      amount: z.number().positive().int().safe(),
      reason: z.string().min(1).max(3_000),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const created = await new SubmitRingi(c).run({
      applicantId: session.employeeId,
      approverId: body.approver_id,
      title: body.title,
      amount: body.amount,
      reason: body.reason,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const responseBody = zAppRingi.parse({
      id: created.id,
      applicant_id: created.applicantId,
      approver_id: created.approverId,
      title: created.title,
      amount: created.amount,
      reason: created.reason,
      status: created.status,
      decided_at: created.decidedAt,
      decision_comment: created.decisionComment,
      created_at: created.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
