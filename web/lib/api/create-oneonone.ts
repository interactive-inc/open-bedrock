import { createClient } from "@/lib/api/hc-client"
import type { OneOnOneCreateRequest } from "@/lib/api/types/oneonone-types"

// POST /oneonone。session cookie のトークンで 1on1 記録を新規作成する。
// 上長は token から解決されるため member_email でメンバーを指定する。
// 戻りは作成された OneOnOne or Error。呼び出し元は instanceof Error で判別する。
export async function createOneOnOne(request: OneOnOneCreateRequest) {
  const client = await createClient()

  const response = await client.oneonone.$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create oneonone")
  }

  return response.json()
}
