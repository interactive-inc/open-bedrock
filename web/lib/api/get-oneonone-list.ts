import { createClient } from "@/lib/api/hc-client"

/** GET /oneonones。session cookie のトークンで本人が参加した 1on1 履歴を取得する。 */
export async function getOneOnOneList(props: { limit: number; offset: number }) {
  const client = await createClient()

  const response = await client.oneonones.$get({
    query: { limit: String(props.limit), offset: String(props.offset) },
  })

  if (response.status >= 400) {
    return new Error("failed to load oneonone list")
  }

  const body = await response.json()

  return { data: body.data, total: body.total }
}
