import { createClient } from "@/lib/api/hc-client"

// GET /oneonones。session cookie のトークンで本人が参加した 1on1 履歴を取得する。
// 戻りは OneOnOne 配列 or Error。呼び出し元は instanceof Error で判別する。
export async function getOneOnOneList() {
  const client = await createClient()

  const response = await client.oneonones.$get()

  if (response.status >= 400) {
    return new Error("failed to load oneonone list")
  }

  return response.json()
}
