import { toWorkforceEmployeeId } from "@/contexts/company/domain/definitions/to-workforce-employee-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
type SeedNotification = {
  id: number
  recipientEmployeeId: EmployeeId
  sourceDomain: string
  sourceId: number | null
  kind: string
  title: string
  body: string | null
  isRead: boolean
  createdAt: string
}

export const seedNotifications: ReadonlyArray<SeedNotification> = [
  {
    id: 1,
    recipientEmployeeId: toWorkforceEmployeeId(5),
    sourceDomain: "application",
    sourceId: 10,
    kind: "approval_request",
    title: "承認待ち",
    body: "このリクエストを確認してください。",
    isRead: false,
    createdAt: "2025-05-20T09:00:00Z",
  },
  {
    id: 2,
    recipientEmployeeId: toWorkforceEmployeeId(5),
    sourceDomain: "manual",
    sourceId: null,
    kind: "announcement",
    title: "既読のお知らせ",
    body: null,
    isRead: true,
    createdAt: "2025-05-22T09:00:00Z",
  },
  {
    id: 3,
    recipientEmployeeId: toWorkforceEmployeeId(5),
    sourceDomain: "reminder",
    sourceId: null,
    kind: "reminder",
    title: "リマインダー",
    body: null,
    isRead: false,
    createdAt: "2025-05-25T09:00:00Z",
  },
  {
    id: 4,
    recipientEmployeeId: toWorkforceEmployeeId(6),
    sourceDomain: "manual",
    sourceId: null,
    kind: "task",
    title: "他の従業員への通知",
    body: null,
    isRead: false,
    createdAt: "2025-05-26T09:00:00Z",
  },
]

export async function seedSystemNotifications(db: D1Database): Promise<void> {
  await db.batch(
    seedNotifications.map((notification) =>
      db
        .prepare(
          `INSERT INTO system_notification_messages
             (id, kind, title, body, source_type, source_id, created_at)
           VALUES (?1, ?2, ?3, ?4, 'company:notification.source', ?5, ?6)`,
        )
        .bind(
          String(notification.id),
          `company:${notification.kind}`,
          notification.title,
          notification.body,
          JSON.stringify({ domain: notification.sourceDomain, id: notification.sourceId }),
          new Date(notification.createdAt).getTime(),
        ),
    ),
  )
  await db.batch(
    seedNotifications.map((notification) => {
      const deliveredAt = new Date(notification.createdAt).getTime()
      return db
        .prepare(
          `INSERT INTO system_notification_deliveries
             (id, message_id, recipient_account_id, delivered_at, read_at)
           VALUES (?1, ?1, ?2, ?3, ?4)`,
        )
        .bind(
          String(notification.id),
          String(notification.recipientEmployeeId),
          deliveredAt,
          notification.isRead ? deliveredAt : null,
        )
    }),
  )
}
