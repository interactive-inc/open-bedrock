import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 経費の承認規程と版を取得する。 */
export async function getExpenseProcedure() {
  const client = await createClient()
  const response = await client.expense["expense-procedures"].$get()
  if (response.status >= 400)
    return toResponseError(response, { fallback: "経費の承認規程を取得できません" })
  return response.json()
}
