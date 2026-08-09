import { DeleteNotification } from "@/application/system/notifications/delete-notification"
import { GetNotification } from "@/application/system/notifications/get-notification"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/interface/lib/errors"
import { toHttpException } from "@/interface/lib/to-http-exception"
import { zAppNotification } from "@/lib/app-schemas"
import { validateIntParam } from "@/interface/utils/validate-int-param"
import { verifyBearer } from "@/interface/middlewares/verify-bearer"
import { factory } from "@/interface/utils/factory"

// @authorization owner - 本人のリソースに限定する
/** GET /notifications/:id — 本人宛ての通知1件を取得する */
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")

  const result = await new GetNotification(c).run({
    notificationId,
    viewerAccountId: session.accountId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  const responseBody = zAppNotification.parse({
    id: result.id,
    recipient_employee_id: session.employeeId,
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

// @authorization owner - 本人のリソースに限定する
/** DELETE /notifications/:id — 本人宛ての通知を削除する */
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")

  const result = await new DeleteNotification(c).run({
    notificationId,
    viewerAccountId: session.accountId,
  })

  if (result instanceof ApplicationError) {
    throw toHttpException(result)
  }

  return c.body(null, 204)
})
