import { createClient } from "@/lib/api/hc-client"

// PUT /onboarding/assignments/:id。割当日を変更する。特権ロールのみ。
export async function updateOnboardingAssignment(id: number, assignedAt: string) {
  const client = await createClient()

  const response = await client.onboarding.assignments[":id"].$put({
    param: { id: String(id) },
    json: { assigned_at: assignedAt },
  })

  if (response.status >= 400) {
    return new Error("failed to update onboarding assignment")
  }

  return response.json()
}
