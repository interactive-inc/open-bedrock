import { DeleteNotification } from "@/application/notification/delete-notification"
import { GetNotification } from "@/application/notification/get-notification"
import type { Notification } from "@/domain/notification/notification"
import {
  BadRequestError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "@/interface/lib/errors"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { factory } from "@/lib/factory"

// 通知をレスポンス用の snake_case に整形する。
function toResponseBody(notification: Notification) {
  return {
    id: notification.id,
    recipient_employee_id: notification.recipientEmployeeId,
    source_domain: notification.sourceDomain,
    source_id: notification.sourceId,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    is_read: notification.isRead,
    created_at: notification.createdAt,
  }
}

// GET /notifications/:id — 本人宛ての通知1件を取得する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = Number(c.req.param("id") ?? "")

  if (Number.isInteger(notificationId) === false) {
    throw new BadRequestError("invalid notification id")
  }

  const result = await new GetNotification(c).run({
    notificationId,
    viewerEmployeeId: session.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to load notification")
  }

  if ("reason" in result) {
    if (result.reason === "notification_not_found") {
      throw new NotFoundError("notification not found")
    }

    throw new ForbiddenError()
  }

  return c.json(toResponseBody(result), 200)
})

// DELETE /notifications/:id — 本人宛ての通知を削除する
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const notificationId = Number(c.req.param("id") ?? "")

  if (Number.isInteger(notificationId) === false) {
    throw new BadRequestError("invalid notification id")
  }

  const result = await new DeleteNotification(c).run({
    notificationId,
    viewerEmployeeId: session.employeeId,
  })

  if (result instanceof Error) {
    throw new InternalError("failed to delete notification")
  }

  if (result.reason === "notification_not_found") {
    throw new NotFoundError("notification not found")
  }

  if (result.reason === "notification_forbidden") {
    throw new ForbiddenError()
  }

  return c.body(null, 204)
})
