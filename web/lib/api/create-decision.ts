import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type DecisionCreateRequest = {
  title: string
  decided_on: string
  context: string
  decision: string
  consequences?: string | null
}

/** POST /decisions。意思決定記録を作成する。失敗時は Error。 */
export async function createDecision(request: DecisionCreateRequest) {
  const client = await createClient()

  const response = await client.decisions.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "意思決定記録の作成に失敗しました",
    })
  }

  return response.json()
}
