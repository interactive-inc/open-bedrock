import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type LifecycleEffect = "hire" | "retired"

export async function updateLifecycleTemplateBinding(
  templateCode: string,
  effectType: LifecycleEffect,
): Promise<{ effect_type: LifecycleEffect; template_code: string } | Error> {
  const client = await createClient()
  const response = await client.onboarding.templates[":code"]["lifecycle-binding"].$put({
    param: { code: templateCode },
    json: { effect_type: effectType },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "入退社イベントとの連携設定に失敗しました",
    })
  }

  return response.json()
}
