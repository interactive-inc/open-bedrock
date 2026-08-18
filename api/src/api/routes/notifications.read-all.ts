import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { zAccountId } from "@system/domain/auth/account-id"
import { SystemNotificationRepository } from "@system/infrastructure/notifications/system-notification-repository"

// @authorization owner - 本人のリソースに限定する
/** POST /notifications/read-all — 本人宛ての未読通知をすべて既読にする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new SystemNotificationRepository({
    context: { env: { DB: c.env.DB } },
  }).markAllDeliveriesRead(
    zAccountId.parse(String(session.accountId)),
    new Date(c.env.NOW ?? Date.now()),
  )
  if (updated instanceof Error) throw updated

  const responseBody = { updated }

  return c.json(responseBody, 200)
})
