import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** PUT /onboarding/assignments/:id。割当日を変更する。特権ロールのみ。 */
export async function updateOnboardingAssignment(id: number, assignedAt: string) {
  const client = await createClient()

  const response = await client.onboarding.assignments[":id"].$put({
    param: { id: String(id) },
    json: { assigned_at: assignedAt },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "オンボーディング割り当ての変更に失敗しました",
      conflictMessages: {
        "assignment is already completed": "完了済みの割り当ては変更できません",
      },
    })
  }

  return response.json()
}
