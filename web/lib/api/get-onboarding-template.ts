import { createClient } from "@/lib/api/hc-client"
import type { OnboardingTemplateDetail } from "@/lib/api/types/onboarding-types"

/**
 * GET /onboarding-templates/:code。管理権限がテンプレート詳細を取得する。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
 */
export async function getOnboardingTemplate(
  code: string,
): Promise<OnboardingTemplateDetail | Error> {
  const client = await createClient()

  const response = await client["onboarding-templates"][":code"].$get({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new Error("failed to load onboarding template")
  }

  return response.json()
}
