import { createClient } from "@/lib/api/hc-client"

/** GET /expenses/inbox。承認者向けの承認待ち経費一覧。 */
export async function getExpenseInbox(offset = 0) {
  const client = await createClient()

  const response = await client["expense"]["expenses"].inbox.$get({
    query: { limit: "20", offset: String(offset) },
  })

  if (response.status >= 400) {
    return new Error("failed to load expense inbox")
  }

  const body = await response.json()
  return body
}
