import { createClient } from "@/lib/api/hc-client"

// 実施中アンケート一覧を取得する。GET /surveys。
export async function getSurveyList() {
  const client = await createClient()

  const response = await client.surveys.$get()

  if (response.status >= 400) {
    return new Error("failed to load surveys")
  }

  return response.json()
}
