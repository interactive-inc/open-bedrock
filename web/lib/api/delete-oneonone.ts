import { createClient } from "@/lib/api/hc-client"

/**
 * DELETE /one-on-ones/:id。1on1 の記録を削除する。
 * 記録した上長以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function deleteOneOnOne(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["one-on-one"]["one-on-ones"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return new Error("1on1記録の削除に失敗しました")
  }

  return null
}
