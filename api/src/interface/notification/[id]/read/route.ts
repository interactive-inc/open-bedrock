import { MarkNotificationRead } from "@/application/notification/mark-notification-read"
import { InternalError, NotFoundError, UnauthorizedError } from "@/interface/lib/errors"
import { validateIntParam } from "@/interface/shared/validate-int-param"
import { factory } from "@/lib/factory"
import { verifyBearer } from "@/interface/shared/verify-bearer"

// POST /notifications/:id/read — 本人宛ての通知を既読にする
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")

  const result = await new MarkNotificationRead(c).run({
    notificationId,
    viewerEmployeeId: session.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to mark notification read")
  }

  if ("reason" in result) {
    throw new NotFoundError("notification not found")
  }

  const responseBody = {
    id: result.id,
    recipient_employee_id: result.recipientEmployeeId,
    source_domain: result.sourceDomain,
    source_id: result.sourceId,
    kind: result.kind,
    title: result.title,
    body: result.body,
    is_read: result.isRead,
    created_at: result.createdAt,
  }

  return c.json(responseBody, 200)
})
