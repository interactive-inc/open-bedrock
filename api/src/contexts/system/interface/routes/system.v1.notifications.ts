import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/notifications */
import { PublishSystemNotification } from "@system/application/notifications/publish-system-notification"
import { zAccountId } from "@system/domain/auth/account-id"
import { NotificationDeliveryBatch } from "@system/domain/notifications/notification-delivery-batch"
import { NotificationDelivery } from "@system/domain/notifications/notification-delivery.entity"
import { NotificationMessage } from "@system/domain/notifications/notification-message.entity"
import { SystemActiveAccountSet } from "@system/infrastructure/auth/system-active-account-set.repository"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification.repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization authenticated - 自分のAccount Deliveryだけを読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "query",
    z.object({
      read: z.enum(["true", "false"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      offset: z.coerce.number().int().min(0).max(10_000).default(0),
    }),
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
    const query = context.req.valid("query")
    const page = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).listForAccount({
      recipientAccountId: accountId.data,
      read: query.read === undefined ? null : query.read === "true",
      limit: query.limit,
      offset: query.offset,
    })
    if (page instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
    }

    return context.json(
      {
        notifications: page.items.map(({ delivery, message }) => ({
          id: delivery.id,
          message_id: message.id,
          kind: message.kind,
          title: message.title,
          body: message.body,
          source:
            message.source === null ? null : { type: message.source.type, id: message.source.id },
          delivered_at: delivery.deliveredAt.toISOString(),
          read_at: delivery.readAt?.toISOString() ?? null,
        })),
        total: page.total,
        limit: query.limit,
        offset: query.offset,
      },
      200,
    )
  },
)

// @authorization permission notification:send - 任意のactive System Accountへ配信する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "json",
    z.object({
      recipient_account_ids: z
        .array(z.string().min(1).max(255).brand<"AccountId">())
        .min(1)
        .max(100),
      kind: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z][a-z0-9_-]{0,62}:[a-z][a-z0-9_-]*(?:[.:][a-z][a-z0-9_-]*)*$/u),
      title: z.string().min(1).max(200),
      body: z.string().min(1).max(10_000).nullable().default(null),
      source: z
        .object({
          type: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z][a-z0-9_-]{0,62}:[a-z][a-z0-9_-]*(?:[.:][a-z][a-z0-9_-]*)*$/u),
          id: z.string().min(1).max(512),
        })
        .strict()
        .nullable()
        .default(null),
    }),
  ),
  async (context) => {
    if (
      !context.var.permissions.has("system:admin") &&
      !context.var.permissions.has("notification:send")
    ) {
      throw new SystemHttpError({
        status: 403,
        code: "forbidden",
        detail: "forbidden",
      })
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
    }
    const body = context.req.valid("json")
    const recipientsAreActive = await new SystemActiveAccountSet({
      env: { DB: context.env.DB },
    }).containsAll(body.recipient_account_ids)
    if (recipientsAreActive instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
    }
    if (!recipientsAreActive) {
      throw new SystemHttpError({
        status: 404,
        code: "notification_recipient_not_found",
        detail: "notification recipient not found",
      })
    }
    const message = NotificationMessage.create({
      id: crypto.randomUUID(),
      kind: body.kind,
      title: body.title,
      body: body.body,
      source: body.source,
      createdAt: now,
    })
    if (message instanceof Error) {
      throw new SystemHttpError({
        status: 400,
        code: "invalid_notification",
        detail: "invalid notification",
      })
    }
    const deliveries = body.recipient_account_ids.map((recipientAccountId) =>
      NotificationDelivery.create({
        id: crypto.randomUUID(),
        messageId: message.id,
        recipientAccountId,
        deliveredAt: now,
        readAt: null,
      }),
    )
    const invalidDelivery = deliveries.find((delivery) => delivery instanceof Error)
    if (invalidDelivery instanceof Error) {
      throw new SystemHttpError({
        status: 400,
        code: "invalid_notification",
        detail: "invalid notification",
      })
    }
    const deliveryBatch = NotificationDeliveryBatch.create(deliveries)
    if (deliveryBatch instanceof Error) {
      throw new SystemHttpError({
        status: 400,
        code: "invalid_notification",
        detail: "invalid notification",
      })
    }

    const publication = await new PublishSystemNotification({
      notificationRepository: new SystemNotificationRepository({
        context: { env: { DB: context.env.DB } },
      }),
    }).execute({ message, deliveries: deliveryBatch })
    if (publication instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
    }
    if (publication.kind === "rejected") {
      throw new SystemHttpError({
        status: 400,
        code: "invalid_notification",
        detail: "invalid notification",
      })
    }

    return context.json(
      {
        message_id: message.id,
        delivery_ids: deliveryBatch.deliveries.map((delivery) => delivery.id),
      },
      201,
    )
  },
)

// @authorization authenticated - 自分の未読Deliveryを一括で既読にする
export const PATCH = systemFactory.createHandlers(
  authenticateSystemAccessToken,
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
    const markedCount = await new SystemNotificationRepository({
      context: { env: { DB: context.env.DB } },
    }).markAllDeliveriesRead(accountId.data, readAt)
    if (markedCount instanceof Error) {
      throw new SystemHttpError({
        status: 503,
        code: "notification_unavailable",
        detail: "notification service unavailable",
      })
    }

    return context.json({ marked_count: markedCount }, 200)
  },
)
