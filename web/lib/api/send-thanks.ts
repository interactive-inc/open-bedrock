import { createClient } from "@/lib/api/hc-client"
import type { ThanksCreateRequest } from "@/lib/api/types/thanks-types"

/**
 * POST /thanks。session cookie のトークンで感謝を送る。送り手は token から解決される。
 * 戻りは作成された感謝 or Error。呼び出し元は instanceof Error で判別する。
 */
export async function sendThanks(request: ThanksCreateRequest) {
  const client = await createClient()

  const response = await client.thanks.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to send thanks")
  }

  return response.json()
}
