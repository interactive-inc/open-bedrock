import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function removeLifecycleTemplateBinding(templateCode: string): Promise<null | Error> {
  const client = await createClient()
  const response = await client["onboarding"]["onboarding-templates"][":code"][
    "lifecycle-binding"
  ].$delete({
    param: { code: templateCode },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "入退社イベントとの連携解除に失敗しました",
    })
  }

  return null
}
