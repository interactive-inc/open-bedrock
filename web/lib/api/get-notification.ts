import { createClient } from "@/lib/api/hc-client"
import type { NotificationResponse } from "@/lib/api/types/notification-types"

// GET /notifications/:id。本人宛ての通知1件を取得する。
export async function getNotification(
  notificationId: number,
): Promise<NotificationResponse | Error> {
  const client = await createClient()

  const response = await client.notifications[":id"].$get({
    param: { id: String(notificationId) },
  })

  if (response.status >= 400) {
    return new Error("failed to load notification")
  }

  return response.json()
}
