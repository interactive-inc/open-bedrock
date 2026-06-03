import { createClient } from "@/lib/api/hc-client"
import type { FamilyCareLeaveCreateRequest } from "@/lib/api/types/family-care-leave-types"

// POST /family-care-leaves。休業申出を作成する。status は requested で登録される。
export async function createFamilyCareLeave(request: FamilyCareLeaveCreateRequest) {
  const client = await createClient()

  const response = await client["family-care-leaves"].$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create family care leave")
  }

  return response.json()
}
