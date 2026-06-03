import { createClient } from "@/lib/api/hc-client"

// DELETE /oneonone/:id。1on1 の記録を削除する。
// 記録した上長以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function deleteOneOnOne(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client.oneonone[":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return new Error("failed to delete oneonone")
  }

  return null
}
