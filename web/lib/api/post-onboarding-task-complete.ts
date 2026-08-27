import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /onboarding-tasks/:id/complete。タスクを完了にして更新後のタスクを返す。 */
export async function postOnboardingTaskComplete(taskId: number) {
  const client = await createClient()

  const response = await client["onboarding"]["onboarding-tasks"][":id"].complete.$post({
    param: { id: String(taskId) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "オンボーディングタスクの完了に失敗しました",
    })
  }

  return response.json()
}
