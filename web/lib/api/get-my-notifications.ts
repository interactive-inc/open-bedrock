import { createClient } from "@/lib/api/hc-client"
import type { NotificationResponse } from "@/lib/api/types/notification-types"

type NotificationListResult = {
  data: Array<NotificationResponse>
  total: number
}

// GET /notifications/me。自分宛ての通知一覧（新着順）を取得する。
export async function getMyNotifications(props: {
  limit: number
  offset: number
}): Promise<NotificationListResult | Error> {
  const client = await createClient()

  const response = await client.notifications.me.$get({
    query: { limit: String(props.limit), offset: String(props.offset) },
  })

  if (response.status >= 400) {
    return new Error("failed to load my notifications")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
