import { MarkAllNotificationsRead } from "@/application/notification/mark-all-notifications-read"
import { InternalError, UnauthorizedError } from "@/interface/lib/errors"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"

// POST /notifications/read-all — 本人宛ての未読通知をすべて既読にする
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const updated = await new MarkAllNotificationsRead(c).run({
    recipientEmployeeId: session.employeeId,
  })

  if (updated instanceof Error) {
    throw new InternalError("failed to mark notifications read")
  }

  const responseBody = { updated }

  return c.json(responseBody, 200)
})
