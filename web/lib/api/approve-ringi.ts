import type { RingiDecisionTarget } from "@/lib/api/types/ringi-types"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** POST /ringi-requests/:id/approve。任意コメント付きで稟議を承認する。表示した判断対象と会社上の判断資格を検査する。 */
export async function approveRingi(
  id: number,
  comment: string | null,
  decisionTarget: RingiDecisionTarget,
) {
  const client = await createClient()

  const response = await client["ringi"]["ringi-requests"][":id"].approve.$post({
    param: { id: String(id) },
    json: { comment: comment, decision_target: decisionTarget },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "稟議の承認に失敗しました",
      conflictMessages: {
        "ringi request already decided": "この稟議は既に決定済みです",
      },
    })
  }

  return response.json()
}
