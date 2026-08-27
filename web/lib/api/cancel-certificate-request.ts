import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** DELETE /certificate-requests/:id。証明書発行依頼を取消する。本人以外は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。 */
export async function cancelCertificateRequest(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["certificate-request"]["certificate-requests"][":id"].$delete({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "証明書発行依頼の取消に失敗しました",
      conflictMessages: {
        "not modifiable": "この証明書発行依頼は取消できません",
      },
    })
  }

  return null
}
