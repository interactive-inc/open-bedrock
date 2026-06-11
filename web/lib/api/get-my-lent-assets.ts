import { createClient } from "@/lib/api/hc-client"

// GET /assets/lent/me。自分が借りている貸与品の一覧。
export async function getMyLentAssets() {
  const client = await createClient()

  const response = await client.assets.lent.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load lent assets")
  }

  const body = await response.json()

  return body.data
}
