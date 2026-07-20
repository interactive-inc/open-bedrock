import { createClient } from "@/lib/api/hc-client"
import type { CertificationResponse } from "@/lib/api/types/certification-types"

/** GET /certifications。資格マスタ一覧を取得する。失敗時は Error を返す。 */
export async function listCertifications(): Promise<ReadonlyArray<CertificationResponse> | Error> {
  const client = await createClient()

  const response = await client.certifications.$get()

  if (response.status >= 400) {
    return new Error("failed to load certifications")
  }

  const body = await response.json()

  return body.data
}
