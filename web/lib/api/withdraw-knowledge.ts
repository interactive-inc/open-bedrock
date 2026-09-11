import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /knowledge-articles/:id。記事を取下げる。作成者以外は 403、不存在は 404 を api が返すため戻りは Error。成功時は null。 */
export async function withdrawKnowledge(
  id: number,
  input: { revision: number; commandId: string; reason: string },
): Promise<null | Error> {
  const client = await createClient()

  const response = await client["knowledge"]["knowledge-articles"][":id"].$delete({
    param: { id: String(id) },
    header: { "if-match": `"${input.revision}"`, "idempotency-key": input.commandId },
    json: { reason: input.reason },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "ナレッジ記事の取下げに失敗しました",
    })
  }

  return null
}
