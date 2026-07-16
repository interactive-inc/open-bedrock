import { createClient } from "@/lib/api/hc-client"

// GET /assets/holdings。現在の保有状況一覧（誰が何を持っているか）。
export async function getAssetHoldings() {
  const client = await createClient()

  const response = await client.assets.holdings.$get({ query: {} })

  if (response.status >= 400) {
    return new Error("failed to load asset holdings")
  }

  const body = await response.json()

  return body.data
}
