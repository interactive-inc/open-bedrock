import { MarkAllNotificationsRead } from "@/application/notification/mark-all-notifications-read"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/middleware/verify-bearer"

/** POST /notifications/read-all — 本人宛ての未読通知をすべて既読にする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new MarkAllNotificationsRead(c).run({
    recipientEmployeeId: session.employeeId,
  })

  if (updated instanceof ApplicationError) {
    throw toHttpException(updated)
  }

  const responseBody = { updated }

  return c.json(responseBody, 200)
})
