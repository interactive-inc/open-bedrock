import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { zAppNotification } from "@/lib/app-schemas"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"
import { companyNotificationKindSchema } from "@/contexts/company/domain/notifications/notification-kind"
import { MarkSystemNotificationRead } from "@system/application/notifications/mark-system-notification-read"
import { zAccountId } from "@system/domain/auth/account-id"
import { notificationDeliveryIdSchema } from "@system/domain/notifications/notification-delivery.entity"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification-repository"
import { NotFoundError } from "@/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
/** POST /notifications/:id/read — 本人宛ての通知を既読にする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")

  const repository = new SystemNotificationRepository({
    context: { env: { DB: c.env.DB } },
  })
  const result = await new MarkSystemNotificationRead({
    notificationRepository: repository,
  }).execute({
    deliveryId: notificationDeliveryIdSchema.parse(String(notificationId)),
    recipientAccountId: zAccountId.parse(String(session.accountId)),
    readAt: new Date(c.env.NOW ?? Date.now()),
  })
  if (result instanceof Error) throw result
  if (result.kind === "not_found") {
    throw toHttpException(new NotFoundError("notification not found", "notification_not_found"))
  }
  if (result.kind === "rejected") {
    throw new Error(`notification read rejected: ${result.reason}`)
  }

  const notification = await repository.findByDeliveryIdForAccount(
    result.delivery.id,
    result.delivery.recipientAccountId,
  )
  if (notification instanceof Error) throw notification
  if (notification === null) {
    throw toHttpException(new NotFoundError("notification not found", "notification_not_found"))
  }
  const kind = companyNotificationKindSchema.parse(
    notification.message.kind.replace(/^company:/, ""),
  )
  const source = z
    .object({ domain: z.string(), id: z.number().int().positive().safe().nullable() })
    .parse(JSON.parse(notification.message.source?.id ?? ""))

  const responseBody = zAppNotification.parse({
    id: notificationId,
    recipient_employee_id: session.employeeId,
    source_domain: source.domain,
    source_id: source.id,
    kind,
    title: notification.message.title,
    body: notification.message.body,
    is_read: notification.delivery.isRead,
    created_at: notification.message.createdAt.toISOString(),
  })

  return c.json(responseBody, 200)
})
