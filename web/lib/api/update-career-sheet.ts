import { createClient } from "@/lib/api/hc-client"
import type { CareerSheetUpdateRequest } from "@/lib/api/types/career-types"

/** 本人のキャリアシートを更新する。PUT /career/sheet/me。 */
export async function updateCareerSheet(body: CareerSheetUpdateRequest) {
  const client = await createClient()

  const response = await client.career.sheet.me.$put({ json: body })

  if (response.status >= 400) {
    return new Error("キャリアシートの更新に失敗しました")
  }

  return response.json()
}
