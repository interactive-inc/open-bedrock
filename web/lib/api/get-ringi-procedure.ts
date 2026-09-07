import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 稟議の承認規程と版を取得する。 */
export async function getRingiProcedure() {
  const client = await createClient()
  const response = await client.ringi["ringi-procedures"].$get()
  if (response.status >= 400)
    return toResponseError(response, { fallback: "稟議の承認規程を取得できません" })
  return response.json()
}
