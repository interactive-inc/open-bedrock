import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * POST /certificate-requests/:id/issue。証明書発行依頼を発行済みにする。
 * 権限なしは 403、不存在は 404、遷移不可は 409 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function issueCertificateRequest(id: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["certificate-request"]["certificate-requests"][":id"].issue.$post({
    param: { id },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "証明書発行依頼の発行に失敗しました",
      conflictMessages: {
        "certificate request is not in a transitionable state": "この依頼は発行できません",
      },
    })
  }

  return null
}
