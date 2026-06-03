import { createClient } from "@/lib/api/hc-client"
import type {
  OnboardingTemplateCreateRequest,
  OnboardingTemplateDetail,
} from "@/lib/api/types/onboarding-types"

// POST /onboarding/templates。管理権限がテンプレートを作成する。
// 権限不足は 403、コード重複は 409 を api が返すため、戻りは Error になる。
export async function createOnboardingTemplate(
  request: OnboardingTemplateCreateRequest,
): Promise<OnboardingTemplateDetail | Error> {
  const client = await createClient()

  const response = await client.onboarding.templates.$post({
    json: {
      code: request.code,
      name: request.name,
      kind: request.kind,
      description: request.description ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to create onboarding template")
  }

  return response.json()
}
