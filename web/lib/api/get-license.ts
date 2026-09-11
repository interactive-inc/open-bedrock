import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 契約の現在のプランと確認版を取得する。 */
export async function getLicense(id: number) {
  const client = await createClient()
  const response = await client["software-license"]["software-licenses"][":id"].$get({
    param: { id: String(id) },
  })
  if (!response.ok) return toResponseError(response, { fallback: "契約を取得できませんでした" })
  return response.json()
}
