import type { CompanyNotificationKind } from "@/domain/company/notifications/notification-kind"

type SeedNotification = {
  id: number
  recipientEmployeeId: number
  sourceDomain: string
  sourceId: number | null
  kind: CompanyNotificationKind
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
    title: "承認待ち",
    body: "このリクエストを確認してください。",
    isRead: false,
    createdAt: "2026-05-20T09:00:00Z",
  },
  {
    id: 2,
    recipientEmployeeId: 5,
    sourceDomain: "manual",
    sourceId: null,
    kind: "announcement",
    title: "既読のお知らせ",
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
    title: "リマインダー",
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
    title: "他の従業員への通知",
    body: null,
    isRead: false,
    createdAt: "2026-05-26T09:00:00Z",
  },
]
