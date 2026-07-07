import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type LicenseCreateRequest = {
  name: string
  vendor?: string | null
  category?: "saas" | "software" | "other" | null
  seats?: number | null
  renewal_deadline?: string | null
  owner_employee_id?: number | null
  note?: string | null
}

// POST /licenses。ライセンス台帳を新規登録する。失敗時は Error。
export async function createLicense(request: LicenseCreateRequest) {
  const client = await createClient()

  const response = await client.licenses.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "ライセンスの登録に失敗しました" })
  }

  return response.json()
}
