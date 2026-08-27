import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { PartnerCreateRequest } from "@/lib/api/types/partner-types"

/** POST /partners。取引先を新規登録する（partner:manage）。 */
export async function createPartner(request: PartnerCreateRequest) {
  const client = await createClient()

  const response = await client["partner"]["partners"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "取引先の登録に失敗しました",
      conflictMessages: {
        "partner code already exists": "この取引先コードは既に登録されています",
      },
    })
  }

  return response.json()
}
