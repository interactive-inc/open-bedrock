import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function decideThanksRedemption(id: number, decision: "approve" | "reject") {
  const client = await createClient()

  const response =
    decision === "approve"
      ? await client["thanks-redemptions"][":id"].approve.$post({ param: { id: String(id) } })
      : await client["thanks-redemptions"][":id"].reject.$post({ param: { id: String(id) } })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback:
        decision === "approve" ? "交換申請の承認に失敗しました" : "交換申請の却下に失敗しました",
      conflictMessages: {
        "reward out of stock": "景品が在庫切れです",
        "redemption already decided": "この申請は既に処理済みです",
      },
    })
  }

  return response.json()
}
