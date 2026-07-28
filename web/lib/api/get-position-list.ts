import { createClient } from "@/lib/api/hc-client"

/** GET /position-definitions。役職マスタ一覧を取得する。誰でも参照できる公開情報。 */
export async function getPositionList() {
  const client = await createClient()

  const response = await client["position-definitions"].$get()

  if (response.status >= 400) {
    return new Error("failed to load positions")
  }

  const body = await response.json()

  return body.data
}
