import { createClient } from "@/lib/api/hc-client"

/** GET /onboarding/me。トークン本人に割り当てられたタスク一覧を返す。 */
export async function getOnboardingMe() {
  const client = await createClient()

  const response = await client.onboarding.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load onboarding tasks")
  }

  const body = await response.json()

  return body.data
}
