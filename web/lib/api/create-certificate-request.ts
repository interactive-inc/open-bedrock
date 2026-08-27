import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { CertificateRequestCreateRequest } from "@/lib/api/types/certificate-request-types"

/** POST /certificate-requests。証明書発行依頼を作成する。status は requested で登録される。 */
export async function createCertificateRequest(request: CertificateRequestCreateRequest) {
  const client = await createClient()

  const response = await client["certificate-request"]["certificate-requests"].$post({
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "証明書発行依頼の作成に失敗しました" })
  }

  return response.json()
}
