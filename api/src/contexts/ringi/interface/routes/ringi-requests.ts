import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { SubmitRingiProcedure } from "@/contexts/ringi/application/submit-ringi-procedure"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zAppRingi } from "@/contexts/ringi/interface/http/response-schemas"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { UnauthorizedError } from "@/lib/http/errors"
import { z } from "zod"

// @authorization service - 本人の提出権限・会社資格・再送キーを保存時にも照合する
/** POST /ringi-requests — 稟議を起案する（会社の承認規程へ提出する） */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      request_key: z.string().uuid(),
      existing_ringi_id: z.number().int().positive().safe().nullable().optional(),
      previous_ringi_id: z.number().int().positive().safe().nullable().optional(),
      approver_id: zEmployeeId,
      title: z.string().min(1).max(200),
      amount: z.number().positive().int().safe(),
      reason: z.string().min(1).max(3_000),
    }),
  ),
  async (c) => {
    const session = c.var.session

    if (session === null || c.var.accountTokenVersion === null) {
      throw new UnauthorizedError()
    }

    const body = c.req.valid("json")

    const submitted = await new SubmitRingiProcedure(c).run({
      requestKey: body.request_key,
      existingRingiId: body.existing_ringi_id ?? null,
      previousRingiId: body.previous_ringi_id ?? null,
      session,
      tokenVersion: c.var.accountTokenVersion,
      approverId: body.approver_id,
      title: body.title,
      amount: body.amount,
      reason: body.reason,
      createdAt: new Date(c.env.NOW ?? Date.now()),
    })

    if (submitted instanceof ApplicationError) {
      throw toHttpException(submitted)
    }

    const created = submitted.request

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

    return c.json(responseBody, submitted.replayed ? 200 : 201)
  },
)
