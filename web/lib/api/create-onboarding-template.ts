import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  OnboardingTemplateCreateRequest,
  OnboardingTemplateDetail,
} from "@/lib/api/types/onboarding-types"

/**
 * POST /onboarding-templates。管理権限がテンプレートを作成する。
 * 権限不足は 403、コード重複は 409 を api が返すため、戻りは Error になる。
 */
export async function createOnboardingTemplate(
  request: OnboardingTemplateCreateRequest,
): Promise<OnboardingTemplateDetail | Error> {
  const client = await createClient()

  const response = await client["onboarding"]["onboarding-templates"].$post({
    json: {
      code: request.code,
      name: request.name,
      kind: request.kind,
      description: request.description ?? undefined,
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "オンボーディングテンプレートの作成に失敗しました",
      conflictMessages: {
        "template code already exists": "このテンプレートコードは既に存在します",
      },
    })
  }

  return response.json()
}
