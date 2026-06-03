import { createClient } from "@/lib/api/hc-client"

// DELETE /onboarding/templates/:code。管理権限がテンプレートを削除する。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteOnboardingTemplate(code: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.onboarding.templates[":code"].$delete({
    param: { code: code },
  })

  if (response.status >= 400) {
    return new Error("failed to delete onboarding template")
  }

  return null
}
