import { createClient } from "@/lib/api/hc-client"

/** GET /ringi-requests/inbox。承認者向けの承認待ち稟議一覧。 */
export async function getRingiInbox(offset = 0) {
  const client = await createClient()

  const response = await client["ringi"]["ringi-requests"].inbox.$get({
    query: { limit: "20", offset: String(offset) },
  })

  if (response.status >= 400) {
    return new Error("failed to load ringi inbox")
  }

  const body = await response.json()
  return body
}
