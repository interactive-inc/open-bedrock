import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { OneOnOneCreateRequest } from "@/lib/api/types/oneonone-types"

/**
 * POST /one-on-ones。session cookie のトークンで 1on1 記録を新規作成する。
 * 上長は token から解決されるため member_employee_code でメンバーを指定する。
 * 戻りは作成された OneOnOne or Error。呼び出し元は instanceof Error で判別する。
 */
export async function createOneOnOne(request: OneOnOneCreateRequest) {
  const client = await createClient()

  const response = await client["one-on-one"]["one-on-ones"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "1on1記録の作成に失敗しました",
      conflictMessages: {
        "one-on-one already exists": "この日付の1on1記録は既に存在します",
      },
    })
  }

  return response.json()
}
