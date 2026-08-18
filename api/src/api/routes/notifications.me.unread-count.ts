import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification-repository"

// @authorization owner - 本人のリソースに限定する
/** GET /notifications/me/unread-count — 本人宛ての未読通知数 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const count = await new SystemNotificationRepository({
    context: { env: { DB: c.env.DB } },
  }).countUnreadForAccount(zAccountId.parse(String(session.accountId)))
  if (count instanceof Error) throw count

  const responseBody = { count }

  return c.json(responseBody, 200)
})
