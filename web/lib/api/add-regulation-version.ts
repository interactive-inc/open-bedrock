import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { RegulationVersionRequest } from "@/lib/api/types/regulation-types"

/** POST /regulations/:code/versions。既存規程へ新しい改定版を追加する（regulation:manage）。 */
export async function addRegulationVersion(code: string, request: RegulationVersionRequest) {
  const client = await createClient()

  const response = await client["regulation"]["regulations"][":code"].versions.$post({
    param: { code: code },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "新版の追加に失敗しました" })
  }

  return response.json()
}
