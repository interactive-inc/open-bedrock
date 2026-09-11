import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 利用開始時のプランと記録者を含む職員の利用記録を保存する。 */
export async function assignLicense(
  licenseId: number,
  command: {
    id: string
    employee_id: string
    account_reference: string | null
    reason: string
  },
) {
  const client = await createClient()
  const response = await client["software-license"]["software-licenses"][":id"].assignments.$post({
    param: { id: String(licenseId) },
    json: command,
  })
  if (!response.ok) return toResponseError(response, { fallback: "利用開始を記録できませんでした" })
  return response.json()
}
