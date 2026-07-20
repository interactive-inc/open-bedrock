import { createClient } from "@/lib/api/hc-client"

/** GET /accounts。アカウント一覧（account:manage が必要）。 */
export async function getAccounts() {
  const client = await createClient()

  const response = await client.accounts.$get()

  if (response.status >= 400) {
    return new Error("failed to load accounts")
  }

  const body = await response.json()

  return body.data
}
