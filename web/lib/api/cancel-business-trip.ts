import { createClient } from "@/lib/api/hc-client"

// DELETE /business-trips/:id。出張申請を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelBusinessTrip(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["business-trips"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel business trip")
  }

  return null
}
