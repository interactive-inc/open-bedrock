import { createClient } from "@/lib/api/hc-client"

// DELETE /notifications/:id。本人宛ての通知を削除する。
// 本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteNotification(notificationId: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.notifications[":id"].$delete({
    param: { id: String(notificationId) },
  })

  if (response.status >= 400) {
    return new Error("failed to delete notification")
  }

  return null
}
