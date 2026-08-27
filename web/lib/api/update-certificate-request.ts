import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  CertificateRequestResponse,
  CertificateRequestUpdateRequest,
} from "@/lib/api/types/certificate-request-types"

/** PUT /certificate-requests/:id。証明書発行依頼の内容を変更する。本人以外は 403 を api が返すため、戻りは Error になる。 */
export async function updateCertificateRequest(
  id: string,
  request: CertificateRequestUpdateRequest,
): Promise<CertificateRequestResponse | Error> {
  const client = await createClient()

  const response = await client["certificate-request"]["certificate-requests"][":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "証明書発行依頼の変更に失敗しました",
      conflictMessages: {
        "not modifiable": "この証明書発行依頼は変更できません",
      },
    })
  }

  return response.json()
}
