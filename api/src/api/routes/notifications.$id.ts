import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppNotification } from "@/lib/app-schemas"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { factory } from "@/contexts/company/interface/utils/factory"
import { companyNotificationKindSchema } from "@/contexts/company/domain/notifications/notification-kind"
import { zAccountId } from "@system/domain/auth/account-id"
import { notificationDeliveryIdSchema } from "@system/domain/notifications/notification-delivery.entity"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification-repository"
import { NotFoundError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** GET /notifications/:id — 本人宛ての通知1件を取得する */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")
  const result = await new SystemNotificationRepository({
    context: { env: { DB: c.env.DB } },
  }).findByDeliveryIdForAccount(
    notificationDeliveryIdSchema.parse(String(notificationId)),
    zAccountId.parse(String(session.accountId)),
  )
  if (result instanceof Error) throw result
  if (result === null) {
    throw toHttpException(new NotFoundError("notification not found", "notification_not_found"))
  }

  const kind = companyNotificationKindSchema.parse(result.message.kind.replace(/^company:/, ""))
  const source = z
    .object({ domain: z.string(), id: z.number().int().positive().safe().nullable() })
    .parse(JSON.parse(result.message.source?.id ?? ""))

  const responseBody = zAppNotification.parse({
    id: notificationId,
    recipient_employee_id: session.employeeId,
    source_domain: source.domain,
    source_id: source.id,
    kind,
    title: result.message.title,
    body: result.message.body,
    is_read: result.delivery.isRead,
    created_at: result.message.createdAt.toISOString(),
  })

  return c.json(responseBody, 200)
})

// @authorization owner - 本人のリソースに限定する
/** DELETE /notifications/:id — 本人宛ての通知を削除する */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")

  const dismissed = await new SystemNotificationRepository({
    context: { env: { DB: c.env.DB } },
  }).dismissDelivery(
    notificationDeliveryIdSchema.parse(String(notificationId)),
    zAccountId.parse(String(session.accountId)),
  )
  if (dismissed instanceof Error) throw dismissed
  if (!dismissed) {
    throw toHttpException(new NotFoundError("notification not found", "notification_not_found"))
  }

  return c.body(null, 204)
})
