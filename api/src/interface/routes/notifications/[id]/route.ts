import { DeleteNotification } from "@/application/notification/delete-notification"
import { GetNotification } from "@/application/notification/get-notification"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppNotification } from "@/lib/app-schemas"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middleware/verify-bearer"
import { factory } from "@/lib/factory"

/** GET /notifications/:id — 本人宛ての通知1件を取得する */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")

  const result = await new GetNotification(c).run({
    notificationId,
    viewerEmployeeId: session.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppNotification.parse({
    id: result.id,
    recipient_employee_id: result.recipientEmployeeId,
    source_domain: result.sourceDomain,
    source_id: result.sourceId,
    kind: result.kind,
    title: result.title,
    body: result.body,
    is_read: result.isRead,
    created_at: result.createdAt,
  })

  return c.json(responseBody, 200)
})

/** DELETE /notifications/:id — 本人宛ての通知を削除する */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")

  const result = await new DeleteNotification(c).run({
    notificationId,
    viewerEmployeeId: session.employeeId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
