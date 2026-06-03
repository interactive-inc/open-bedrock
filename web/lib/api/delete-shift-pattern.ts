import { createClient } from "@/lib/api/hc-client"

// DELETE /shift/patterns/:id。特権ロールがシフトパターンを削除する。成功時は null。
export async function deleteShiftPattern(id: number): Promise<null | Error> {
  const client = await createClient()

  const response = await client.shift.patterns[":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to delete shift pattern")
  }

  return null
}
