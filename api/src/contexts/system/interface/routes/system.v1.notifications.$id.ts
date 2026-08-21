import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/notifications/:id */
import { MarkSystemNotificationRead } from "@system/application/notifications/mark-system-notification-read"
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification.repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 自分のAccount Deliveryだけを読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    const notification = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).findByDeliveryIdForAccount(context.req.valid("param").id, accountId.data)
    if (notification instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
    }
    if (notification === null) {
      throw new SystemHttpError({
        status: 404,
        code: "notification_not_found",
        detail: "notification not found",
      })
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
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
  zValidator("json", z.object({ read: z.literal(true) })),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    const readAt = context.var.now()
    if (!Number.isSafeInteger(readAt.getTime())) {
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
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
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
    }
    if (transition.kind === "not_found") {
      throw new SystemHttpError({
        status: 404,
        code: "notification_not_found",
        detail: "notification not found",
      })
    }
    if (transition.kind === "rejected") {
      throw new SystemHttpError({
        status: 409,
        code: "invalid_notification_transition",
        detail: "invalid notification transition",
      })
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
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.object({ id: z.string().min(1).max(255).brand<"NotificationDeliveryId">() }),
  ),
  async (context) => {
    const accountId = zAccountId.safeParse(context.var.userId)
    if (!accountId.success) {
      throw new SystemHttpError({
        status: 401,
        code: "invalid_session",
        detail: "invalid session",
      })
    }
    const dismissed = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).dismissDelivery(context.req.valid("param").id, accountId.data)
    if (dismissed instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
    }
    if (!dismissed) {
      throw new SystemHttpError({
        status: 404,
        code: "notification_not_found",
        detail: "notification not found",
      })
    }

    return context.body(null, 204)
  },
)
