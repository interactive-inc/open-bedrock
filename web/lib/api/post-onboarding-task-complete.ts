import { createClient } from "@/lib/api/hc-client"

// POST /onboarding/tasks/:id/complete。タスクを完了にして更新後のタスクを返す。
export async function postOnboardingTaskComplete(taskId: number) {
  const client = await createClient()

  const response = await client.onboarding.tasks[":id"].complete.$post({
    param: { id: String(taskId) },
  })

  if (response.status >= 400) {
    return new Error("failed to complete onboarding task")
  }

  return response.json()
}
