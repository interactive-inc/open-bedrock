import { createClient } from "@/lib/api/hc-client"

// GET /templates。任意で category で絞り込む申請テンプレ一覧。
export async function getApplicationTemplates(category: string | null) {
  const client = await createClient()

  const response = await client.templates.$get({
    query: { category: category ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load application templates")
  }

  return response.json()
}
