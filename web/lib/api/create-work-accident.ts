import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { WorkAccidentCreateRequest } from "@/lib/api/types/work-accident-types"

// POST /work-accidents。労災・事故の発生記録を登録する。失敗時は Error を返す。
export async function createWorkAccident(request: WorkAccidentCreateRequest) {
  const client = await createClient()

  const response = await client["work-accidents"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "労災・事故記録の登録に失敗しました",
    })
  }

  return response.json()
}
