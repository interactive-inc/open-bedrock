import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

// POST /licenses/:id/cancel。ライセンスを解約済みに倒す。失敗時は Error。
export async function cancelLicense(id: number) {
  const client = await createClient()

  const response = await client.licenses[":id"].cancel.$post({ param: { id: String(id) } })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "ライセンスの解約に失敗しました" })
  }

  return response.json()
}
