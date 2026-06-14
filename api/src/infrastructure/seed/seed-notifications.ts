import type { NotificationKind } from "@/domain/notification/notification.entity"

type SeedNotification = {
  id: number
  recipientEmployeeId: number
  sourceDomain: string
  sourceId: number | null
  kind: NotificationKind
  title: string
  body: string | null
  isRead: boolean
  createdAt: string
}

export const seedNotifications: ReadonlyArray<SeedNotification> = [
  {
    id: 1,
    recipientEmployeeId: 5,
    sourceDomain: "application",
    sourceId: 10,
    kind: "approval_request",
    title: "Approval pending",
    body: "Please review this request.",
    isRead: false,
    createdAt: "2026-05-20T09:00:00Z",
  },
  {
    id: 2,
    recipientEmployeeId: 5,
    sourceDomain: "manual",
    sourceId: null,
    kind: "announcement",
    title: "Read announcement",
    body: null,
    isRead: true,
    createdAt: "2026-05-22T09:00:00Z",
  },
  {
    id: 3,
    recipientEmployeeId: 5,
    sourceDomain: "reminder",
    sourceId: null,
    kind: "reminder",
    title: "Reminder",
    body: null,
    isRead: false,
    createdAt: "2026-05-25T09:00:00Z",
  },
  {
    id: 4,
    recipientEmployeeId: 6,
    sourceDomain: "manual",
    sourceId: null,
    kind: "task",
    title: "Another employee notification",
    body: null,
    isRead: false,
    createdAt: "2026-05-26T09:00:00Z",
  },
]
