import { createClient } from "@/lib/api/hc-client"

// GET /onboarding/employee/:code。社員コードの割当（assignment）一覧を返す。
export async function getOnboardingEmployee(code: string) {
  const client = await createClient()

  const response = await client.onboarding.employee[":code"].$get({
    param: { code },
  })

  if (response.status >= 400) {
    return new Error("failed to load onboarding assignments")
  }

  const body = await response.json()

  return body.data
}
