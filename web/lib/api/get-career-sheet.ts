import { createClient } from "@/lib/api/hc-client"

/** 本人のキャリアシートを取得する。GET /career/sheet/me。 */
export async function getCareerSheet() {
  const client = await createClient()

  const response = await client.career.sheet.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load career sheet")
  }

  return response.json()
}
