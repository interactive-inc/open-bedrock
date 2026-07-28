import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { FamilyCareLeaveCreateRequest } from "@/lib/api/types/family-care-leave-types"

/** POST /family-care-leaves。休業申出を作成する。status は requested で登録される。 */
export async function createFamilyCareLeave(request: FamilyCareLeaveCreateRequest) {
  const client = await createClient()

  const response = await client["family-care-leaves"].$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "休業申出の作成に失敗しました",
      conflictMessages: {
        "overlapping family care leave already exists": "期間が重複する休業申出が既にあります",
      },
    })
  }

  return response.json()
}
