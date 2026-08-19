/** /system/v1/notifications/:id */
import { MarkSystemNotificationRead } from "@system/application/notifications/mark-system-notification-read"
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification-repository"
import { authenticateSystemSession } from "@system/interface/http/authenticate-system-session"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 自分のAccount Deliveryだけを読む
export const GET = systemFactory.createHandlers(
  authenticateSystemSession,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }
    const notification = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).findByDeliveryIdForAccount(context.req.valid("param").id, accountId.data)
    if (notification instanceof Error) {
      return context.json(
        { error: "notification service unavailable", code: "notification_unavailable" },
        503,
      )
    }
    if (notification === null) {
      return context.json({ error: "notification not found", code: "notification_not_found" }, 404)
    }

    return context.json(
      {
        id: notification.delivery.id,
        message_id: notification.message.id,
        kind: notification.message.kind,
        title: notification.message.title,
        body: notification.message.body,
        source:
          notification.message.source === null
            ? null
            : {
                type: notification.message.source.type,
                id: notification.message.source.id,
              },
        delivered_at: notification.delivery.deliveredAt.toISOString(),
        read_at: notification.delivery.readAt?.toISOString() ?? null,
      },
      200,
    )
  },
)

// @authorization owner - 自分のAccount Deliveryだけを単調に既読化する
export const PATCH = systemFactory.createHandlers(
  authenticateSystemSession,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
  zValidator("json", z.object({ read: z.literal(true) })),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }
    const readAt = context.var.now()
    if (!Number.isSafeInteger(readAt.getTime())) {
      return context.json(
        { error: "notification service unavailable", code: "notification_unavailable" },
        503,
      )
    }
    const transition = await new MarkSystemNotificationRead({
      notificationRepository: new SystemNotificationRepository({
        context: { env: { DB: context.env.DB } },
      }),
    }).execute({
      deliveryId: context.req.valid("param").id,
      recipientAccountId: accountId.data,
      readAt,
    })
    if (transition instanceof Error) {
      return context.json(
        { error: "notification service unavailable", code: "notification_unavailable" },
        503,
      )
    }
    if (transition.kind === "not_found") {
      return context.json({ error: "notification not found", code: "notification_not_found" }, 404)
    }
    if (transition.kind === "rejected") {
      return context.json(
        { error: "invalid notification transition", code: "invalid_notification_transition" },
        409,
      )
    }

    return context.json(
      {
        id: transition.delivery.id,
        read_at: transition.delivery.readAt?.toISOString() ?? null,
      },
      200,
    )
  },
)

// @authorization owner - 自分のAccount Deliveryだけを非表示にする
export const DELETE = systemFactory.createHandlers(
  authenticateSystemSession,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      return context.json({ error: "invalid session", code: "invalid_session" }, 401)
    }
    const dismissed = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).dismissDelivery(context.req.valid("param").id, accountId.data)
    if (dismissed instanceof Error) {
      return context.json(
        { error: "notification service unavailable", code: "notification_unavailable" },
        503,
      )
    }
    if (!dismissed) {
      return context.json({ error: "notification not found", code: "notification_not_found" }, 404)
    }

    return context.body(null, 204)
  },
)
