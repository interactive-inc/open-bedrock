import { createClient } from "@/lib/api/hc-client"
import type { CertificateRequestResponse } from "@/lib/api/types/certificate-request-types"

/** GET /certificate-requests/me。依頼者本人の証明書発行依頼一覧を取得する。 */
export async function listMyCertificateRequests(): Promise<
  ReadonlyArray<CertificateRequestResponse> | Error
> {
  const client = await createClient()

  const response = await client["certificate-request"]["certificate-requests"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load certificate requests")
  }

  const body = await response.json()

  return body.data
}
