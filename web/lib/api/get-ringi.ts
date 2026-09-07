import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 稟議の内容と現在の判断対象を取得する。 */
export async function getRingi(id: number) {
  const client = await createClient()
  const response = await client.ringi["ringi-requests"][":id"].$get({ param: { id: String(id) } })
  if (response.status >= 400) return toResponseError(response, { fallback: "稟議を取得できません" })
  return response.json()
}
