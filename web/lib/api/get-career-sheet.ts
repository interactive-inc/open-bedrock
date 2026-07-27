import { createClient } from "@/lib/api/hc-client"

/** 本人のキャリアシートを取得する。GET /career-sheets/me。 */
export async function getCareerSheet() {
  const client = await createClient()

  const response = await client["career-sheets"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load career sheet")
  }

  return response.json()
}
