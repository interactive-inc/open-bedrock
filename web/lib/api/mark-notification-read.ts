import { createClient } from "@/lib/api/hc-client"
import type { NotificationResponse } from "@/lib/api/types/notification-types"

// POST /notifications/:id/read。指定した通知を既読にする。
export async function markNotificationRead(
  notificationId: number,
): Promise<NotificationResponse | Error> {
  const client = await createClient()

  const response = await client.notifications[":id"].read.$post({
    param: { id: String(notificationId) },
  })

  if (response.status >= 400) {
    return new Error("failed to mark notification as read")
  }

  return response.json()
}
