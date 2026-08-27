import { createClient } from "@/lib/api/hc-client"
import type { OnboardingKind } from "@/lib/api/types/onboarding-types"

/** GET /onboarding-templates。kind 指定時は join / leave で絞り込む。 */
export async function getOnboardingTemplates(kind: OnboardingKind | null) {
  const client = await createClient()

  const response = await client["onboarding"]["onboarding-templates"].$get({
    query: { kind: kind ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load onboarding templates")
  }

  const body = await response.json()

  return body.data
}
