import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /onboarding/tasks/:id/uncomplete。タスクの完了を取り消して更新後のタスクを返す。
export async function postOnboardingTaskUncomplete(taskId: number) {
  const client = await createClient()

  const response = await client.onboarding.tasks[":id"].uncomplete.$post({
    param: { id: String(taskId) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "オンボーディングタスクの完了取消に失敗しました",
    })
  }

  return response.json()
}
