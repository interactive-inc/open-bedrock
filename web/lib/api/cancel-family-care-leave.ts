import { createClient } from "@/lib/api/hc-client"

// DELETE /family-care-leaves/:id。休業申出を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelFamilyCareLeave(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["family-care-leaves"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel family care leave")
  }

  return null
}
