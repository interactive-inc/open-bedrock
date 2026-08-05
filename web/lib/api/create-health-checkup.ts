import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { HealthCheckupCreateRequest } from "@/lib/api/types/health-checkup-types"

/**
 * POST /health-checkups。健診・ストレスチェックの実施記録を登録する。
 * 戻りは作成された実施記録 or Error。呼び出し元は instanceof Error で判別する。
 */
export async function createHealthCheckup(request: HealthCheckupCreateRequest) {
  const client = await createClient()

  const response = await client["health-checkups"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "実施記録の登録に失敗しました",
    })
  }

  return response.json()
}
