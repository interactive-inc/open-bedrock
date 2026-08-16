import { MarkNotificationRead } from "@/api/legacy-system/use-cases/notifications/mark-notification-read"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/contexts/company/interface/lib/errors"
import { toHttpException } from "@/contexts/company/interface/lib/to-http-exception"
import { zAppNotification } from "@/lib/app-schemas"
import { validateIntParam } from "@/contexts/company/interface/utils/validate-int-param"
import { factory } from "@/contexts/company/interface/utils/factory"
import { verifyBearer } from "@/contexts/company/interface/middlewares/verify-bearer"

// @authorization owner - 本人のリソースに限定する
/** POST /notifications/:id/read — 本人宛ての通知を既読にする */
export const POST = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = validateIntParam(c.req.param("id"), "notification")

  const result = await new MarkNotificationRead(c).run({
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
