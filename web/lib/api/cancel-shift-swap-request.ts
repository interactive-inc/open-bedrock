import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /shift/swap-requests/:id。申請者本人が保留中の交代申請を取り下げる。成功時は null。 */
export async function cancelShiftSwapRequest(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.shift["swap-requests"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "シフト交代申請の取り下げに失敗しました",
      conflictMessages: {
        "approved swap request cannot be cancelled": "承認済みの交代申請は取り下げできません",
      },
    })
  }

  return null
}
