import { createClient } from "@/lib/api/hc-client"

// GET /regulations/:code。規程1件の詳細（最新版＋版一覧）。
export async function getRegulationDetail(code: string) {
  const client = await createClient()

  const response = await client.regulations[":code"].$get({
    param: { code: code },
  })

  if (!response.ok) {
    return new Error("failed to load regulation")
  }

  return response.json()
}
