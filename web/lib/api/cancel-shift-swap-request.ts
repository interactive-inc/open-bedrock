import { createClient } from "@/lib/api/hc-client"

// DELETE /shift/swap-requests/:id。申請者本人が保留中の交代申請を取り下げる。成功時は null。
export async function cancelShiftSwapRequest(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.shift["swap-requests"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel shift swap request")
  }

  return null
}
