import { createClient } from "@/lib/api/hc-client"

/** GET /grade-definitions。等級マスタ一覧を取得する。誰でも参照できる公開情報。 */
export async function getGradeList() {
  const client = await createClient()

  const response = await client.company["grade-definitions"].$get()

  if (response.status >= 400) {
    return new Error("failed to load grades")
  }

  const body = await response.json()

  return body.data
}
