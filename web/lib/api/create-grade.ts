import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { GradeCreateRequest } from "@/lib/api/types/grade-types"

/**
 * POST /grade-definitions。等級マスタを新規作成する。
 * 戻りは作成された Grade or Error。呼び出し元は instanceof Error で判別する。
 */
export async function createGrade(request: GradeCreateRequest) {
  const client = await createClient()

  const response = await client.company["grade-definitions"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "等級の作成に失敗しました",
    })
  }

  return response.json()
}
