/** /system/v1/notifications/unread-count */
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification-repository"
import { authenticateSystemSession } from "@system/interface/http/authenticate-system-session"
import { systemFactory } from "@system/interface/http/system-factory"

// @authorization authenticated - 自分のAccount Deliveryだけを集計する
export const GET = systemFactory.createHandlers(authenticateSystemSession, async (context) => {
  const accountId = zAccountId.safeParse(context.var.userId)
  if (!accountId.success) {
    return context.json({ error: "invalid session", code: "invalid_session" }, 401)
  }
  const unreadCount = await new SystemNotificationRepository({
    context: { env: { DB: context.env.DB } },
  }).countUnreadForAccount(accountId.data)
  if (unreadCount instanceof Error) {
    return context.json(
      { error: "notification service unavailable", code: "notification_unavailable" },
      503,
    )
  }

  return context.json({ unread_count: unreadCount }, 200)
})
