import { createClient } from "@/lib/api/hc-client"
import type { MarkAllReadResponse } from "@/lib/api/types/notification-types"

// POST /notifications/read-all。自分宛ての未読通知をすべて既読にする。
export async function markAllNotificationsRead(): Promise<MarkAllReadResponse | Error> {
  const client = await createClient()

  const response = await client.notifications["read-all"].$post()

  if (response.status >= 400) {
    return new Error("failed to mark all notifications as read")
  }

  return response.json()
}
