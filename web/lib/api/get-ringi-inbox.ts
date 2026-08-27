import { createClient } from "@/lib/api/hc-client"

/** GET /ringi-requests/inbox。承認者向けの承認待ち稟議一覧。 */
export async function getRingiInbox() {
  const client = await createClient()

  const response = await client["ringi"]["ringi-requests"].inbox.$get()

  if (response.status >= 400) {
    return new Error("failed to load ringi inbox")
  }

  const body = await response.json()
  return body.data
}
