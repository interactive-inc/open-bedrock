import { SendNotification } from "@/application/notification/send-notification"
import { notificationKindSchema } from "@/domain/notification/notification.entity"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppNotification } from "@/lib/app-schemas"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { codeSchema } from "@/lib/schemas"

// POST /notifications — 権限を持つ役割が通知を作成する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      recipient_employee_code: codeSchema,
      kind: notificationKindSchema.default("announcement"),
      title: z.string().min(1).max(500),
      body: z.string().max(5_000).optional(),
      source_domain: z.string().max(100).optional(),
      source_id: z.number().int().positive().safe().optional(),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const result = await new SendNotification(c).run({
      viewerRole: session.role,
      recipientEmployeeCode: body.recipient_employee_code,
      kind: body.kind,
      title: body.title,
      body: body.body ?? null,
      sourceDomain: body.source_domain ?? "manual",
      sourceId: body.source_id ?? null,
      createdAt: c.env.NOW ?? new Date().toISOString(),
    })

    if (result instanceof ApplicationError) {
      throw toHttpException(result)
    }

    const responseBody = zAppNotification.parse({
      id: result.id,
      recipient_employee_id: result.recipientEmployeeId,
      source_domain: result.sourceDomain,
      source_id: result.sourceId,
      kind: result.kind,
      title: result.title,
      body: result.body,
      is_read: result.isRead,
      created_at: result.createdAt,
    })

    return c.json(responseBody, 201)
  },
)
