import { createClient } from "@/lib/api/hc-client"

type RingiStatus = "pending" | "approved" | "rejected"

/** GET /ringi-requests/me。自分が起案した稟議の一覧。status で絞り込み可能。 */
export async function getMyRingi(status: RingiStatus | null) {
  const client = await createClient()

  const response = await client["ringi"]["ringi-requests"].me.$get({
    query: { status: status ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load my ringi")
  }

  const body = await response.json()
  return body.data
}
