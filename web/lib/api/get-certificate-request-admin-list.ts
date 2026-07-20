import { createClient } from "@/lib/api/hc-client"

export type CertificateRequestAdminFilter = {
  status: string | null
  employeeId: number | null
}

type Params = {
  limit?: number
  offset?: number
}

/** GET /certificate-requests/admin。全社の証明書発行依頼を横断で取得する。certificate_request:read:all が無いと 403。 */
export async function getCertificateRequestAdminList(
  filter: CertificateRequestAdminFilter,
  params: Params = {},
) {
  const client = await createClient()

  const response = await client["certificate-requests"].admin.$get({
    query: {
      status: filter.status ?? undefined,
      employee_id: filter.employeeId !== null ? String(filter.employeeId) : undefined,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load certificate request admin list")
  }

  return response.json()
}
