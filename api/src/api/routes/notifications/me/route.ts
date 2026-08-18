import { companyNotificationKindSchema } from "@/contexts/company-compatibility/domain/company/notifications/notification-kind"
import { factory } from "@/contexts/company-compatibility/interface/utils/factory"
import { zAppNotificationList } from "@/lib/app-schemas"
import { toNotificationSearchQuery } from "@/api/routes/notifications/me/to-notification-search-query"
import { verifyBearer } from "@/contexts/company-compatibility/interface/middlewares/verify-bearer"
import { notifications } from "@/contexts/system-compatibility/infrastructure/schema/system"
import { UnauthorizedError } from "@/contexts/company-compatibility/interface/lib/errors"
import { and, count, desc, eq } from "drizzle-orm"
import type { SQL } from "drizzle-orm"

// @authorization owner - 本人のリソースに限定する
/** GET /notifications/me — 本人宛ての通知一覧（新着順） */
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

  const conditions: Array<SQL> = [eq(notifications.recipientAccountId, session.accountId)]

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

  const totalRows = await c.var.database
    .select({ total: count() })
    .from(notifications)
    .where(and(...conditions))

  const data = rows.flatMap((row) => {
    const kind = companyNotificationKindSchema.safeParse(row.kind)

    if (!kind.success) {
      return []
    }

    return [
      {
        id: row.id,
        recipient_employee_id: session.employeeId,
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

  const responseBody = zAppNotificationList.parse({ data, total: totalRows.at(0)?.total ?? 0 })

  return c.json(responseBody, 200)
})
