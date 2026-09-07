import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { RingiDecisionTarget } from "@/lib/api/types/ringi-types"

/** 確認した稟議を確定する。 */
export async function executeRingi(id: number, target: RingiDecisionTarget) {
  const client = await createClient()
  const response = await client.ringi["ringi-requests"][":id"].execute.$post({
    param: { id: String(id) },
    json: { decision_target: target },
  })
  if (response.status >= 400) return toResponseError(response, { fallback: "稟議を確定できません" })
  return response.json()
}
