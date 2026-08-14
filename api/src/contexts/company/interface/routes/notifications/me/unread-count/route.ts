import { factory } from "@/interface/utils/factory"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { notifications } from "@/schema"
import { UnauthorizedError } from "@/interface/lib/errors"
import { and, count, eq } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /notifications/me/unread-count — 本人宛ての未読通知数 */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const rows = await c.var.database
    .select({ total: count() })
    .from(notifications)
    .where(
      and(eq(notifications.recipientAccountId, session.accountId), eq(notifications.isRead, 0)),
    )

  const responseBody = { count: rows.at(0)?.total ?? 0 }

  return c.json(responseBody, 200)
})
