import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /regulations/:code/archive。規程をアーカイブする（regulation:manage）。 */
export async function archiveRegulation(code: string) {
  const client = await createClient()

  const response = await client["regulation"]["regulations"][":code"].archive.$post({
    param: { code: code },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "規程のアーカイブに失敗しました" })
  }

  return response.json()
}
