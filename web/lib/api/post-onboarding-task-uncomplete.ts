import { createClient } from "@/lib/api/hc-client"

// POST /onboarding/tasks/:id/uncomplete。タスクの完了を取り消して更新後のタスクを返す。
export async function postOnboardingTaskUncomplete(taskId: number) {
  const client = await createClient()

  const response = await client.onboarding.tasks[":id"].uncomplete.$post({
    param: { id: String(taskId) },
  })

  if (response.status >= 400) {
    return new Error("failed to uncomplete onboarding task")
  }

  return response.json()
}
