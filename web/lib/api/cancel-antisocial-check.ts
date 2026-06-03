import { createClient } from "@/lib/api/hc-client"

// DELETE /antisocial-checks/:id。反社チェック申請を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
export async function cancelAntisocialCheck(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["antisocial-checks"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return new Error("failed to cancel antisocial check")
  }

  return null
}
