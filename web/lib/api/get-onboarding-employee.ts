import { createClient } from "@/lib/api/hc-client"

/** GET /onboarding-assignments/employees/:employeeCode。社員コードの割当（assignment）一覧を返す。 */
export async function getOnboardingEmployee(code: string) {
  const client = await createClient()

  const response = await client["onboarding-assignments"].employees[":employeeCode"].$get({
    param: { employeeCode: code },
  })

  if (response.status >= 400) {
    return new Error("failed to load onboarding assignments")
  }

  const body = await response.json()

  return body.data
}
