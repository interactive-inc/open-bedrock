import { createClient } from "@/lib/api/hc-client"
import type { NotificationCreateRequest } from "@/lib/api/types/notification-types"

/** POST /notifications。特権ロールが対象社員へ通知を作成する。 */
export async function createNotification(request: NotificationCreateRequest) {
  const client = await createClient()

  const response = await client.notifications.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create notification")
  }

  return response.json()
}
