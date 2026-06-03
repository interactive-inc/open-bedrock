import { createClient } from "@/lib/api/hc-client"

// DELETE /onboarding/assignments/:id。割り当てを配下タスクごと取り消す。特権ロールのみ。
// 成功時は null、失敗時は Error を返す。
export async function cancelOnboardingAssignment(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.onboarding.assignments[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel onboarding assignment")
  }

  return null
}
