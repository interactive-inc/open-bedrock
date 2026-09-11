import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 契約の利用者と解除履歴をページ単位で取得する。 */
export async function getLicenseAssignments(query: {
  licenseId: number
  state: "assigned" | "released"
  offset: number
}) {
  const client = await createClient()
  const response = await client["software-license"]["software-licenses"].assignments.$get({
    query: {
      license_id: String(query.licenseId),
      state: query.state,
      limit: "20",
      offset: String(query.offset),
    },
  })
  if (!response.ok) return toResponseError(response, { fallback: "利用者を取得できませんでした" })
  return response.json()
}
