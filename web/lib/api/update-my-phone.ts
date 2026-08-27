import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** PUT /me/phone。本人が自己申告する電話番号を更新する。 */
export async function updateMyPhone(
  phone: string | null,
): Promise<{ phone: string | null } | Error> {
  const client = await createClient()

  const response = await client.company["my-profile"].$put({ json: { phone } })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "電話番号の更新に失敗しました" })
  }

  return response.json()
}
