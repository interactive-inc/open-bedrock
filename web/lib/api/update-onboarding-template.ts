import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  OnboardingTemplateDetail,
  OnboardingTemplateUpdateRequest,
} from "@/lib/api/types/onboarding-types"

// PUT /onboarding/templates/:code。管理権限がテンプレートの内容を変更する。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。code は変更されない。
export async function updateOnboardingTemplate(
  code: string,
  request: OnboardingTemplateUpdateRequest,
): Promise<OnboardingTemplateDetail | Error> {
  const client = await createClient()

  const response = await client.onboarding.templates[":code"].$put({
    param: { code: code },
    json: {
      name: request.name,
      kind: request.kind,
      description: request.description ?? undefined,
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "オンボーディングテンプレートの変更に失敗しました",
    })
  }

  return response.json()
}
