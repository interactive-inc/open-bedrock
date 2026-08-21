import { SystemHttpError } from "@system/interface/http/errors/system-http-error"
/** /system/v1/notifications/unread-count */
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification.repository"
import { authenticateSystemAccessToken } from "@system/interface/http/authenticate-system-access-token"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization authenticated - 自分のAccount Deliveryだけを集計する
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const accountId = zAccountId.safeParse(context.var.userId)
  if (!accountId.success) {
    throw new SystemHttpError({
      status: 401,
      code: "invalid_session",
      detail: "invalid session",
    })
  }
  const unreadCount = await new SystemNotificationRepository({
    context: { env: { DB: context.env.DB } },
  }).countUnreadForAccount(accountId.data)
  if (unreadCount instanceof Error) {
    throw new SystemHttpError({
      status: 503,
      code: "notification_unavailable",
      detail: "notification service unavailable",
    })
  }

  return context.json({ unread_count: unreadCount }, 200)
})
