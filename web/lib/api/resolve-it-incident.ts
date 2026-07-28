import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /it-incidents/:id/resolve。インシデントを解消済みに倒す。失敗時は Error。 */
export async function resolveItIncident(id: number) {
  const client = await createClient()

  const response = await client["it-incidents"][":id"].resolve.$post({ param: { id: String(id) } })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "インシデントの解消に失敗しました",
      conflictMessages: { "it incident already resolved": "すでに解消済みです" },
    })
  }

  return response.json()
}
