import { notificationKindSchema } from "@/domain/notification/notification"
import { factory } from "@/lib/factory"
import { toNotificationSearchQuery } from "@/interface/notification/me/to-notification-search-query"
import { verifyBearer } from "@/interface/shared/verify-bearer"
import { notifications } from "@/schema"
import { UnauthorizedError } from "@/interface/lib/errors"
import { and, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

// GET /notifications/me — 本人宛ての通知一覧（新着順）
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session

  if (session === null) {
    throw new UnauthorizedError()
  }

  const query = toNotificationSearchQuery({
    isRead: c.req.query("is_read"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  })

  const conditions: Array<SQL> = [eq(notifications.recipientEmployeeId, session.employeeId)]

  if (query.isRead !== null) {
    conditions.push(eq(notifications.isRead, query.isRead ? 1 : 0))
  }

  const rows = await c.var.database
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(query.limit)
    .offset(query.offset)

  const responseBody = rows.flatMap((row) => {
    const kind = notificationKindSchema.safeParse(row.kind)

    if (!kind.success) {
      return []
    }

    return [
      {
        id: row.id,
        recipient_employee_id: row.recipientEmployeeId,
        source_domain: row.sourceDomain,
        source_id: row.sourceId,
        kind: kind.data,
        title: row.title,
        body: row.body,
        is_read: row.isRead !== 0,
        created_at: row.createdAt,
      },
    ]
  })

  return c.json(responseBody, 200)
})
