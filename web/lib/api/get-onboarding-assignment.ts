import { createClient } from "@/lib/api/hc-client"

// GET /onboarding/assignments/:id。割り当て1件を返す。本人か特権ロールのみ。
export async function getOnboardingAssignment(id: number) {
  const client = await createClient()

  const response = await client.onboarding.assignments[":id"].$get({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to load onboarding assignment")
  }

  return response.json()
}
