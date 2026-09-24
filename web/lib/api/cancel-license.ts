import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /software-licenses/:id/cancel。ライセンスを解約済みに倒す。失敗時は Error。 */
export async function cancelLicense(id: EntityId, expectedRevision: number) {
  const client = await createClient()

  const response = await client["software-license"]["software-licenses"][":id"].cancel.$post({
    header: { "if-match": String(expectedRevision) },
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "ライセンスの解約に失敗しました" })
  }

  return response.json()
}
