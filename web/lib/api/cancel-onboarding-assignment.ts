import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /onboarding-assignments/:id。割り当てを配下タスクごと取り消す。特権ロールのみ。
 * 成功時は null、失敗時は Error を返す。
 */
export async function cancelOnboardingAssignment(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client["onboarding"]["onboarding-assignments"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "オンボーディング割り当ての取消に失敗しました",
      conflictMessages: {
        "assignment is already completed": "完了済みの割り当ては取消できません",
      },
    })
  }

  return null
}
