import { createClient } from "@/lib/api/hc-client"
import type {
  FamilyCareLeaveResponse,
  FamilyCareLeaveUpdateRequest,
} from "@/lib/api/types/family-care-leave-types"

// PUT /family-care-leaves/:id。休業申出の内容を変更する。本人以外は 403 を api が返すため、戻りは Error になる。
export async function updateFamilyCareLeave(
  id: string,
  request: FamilyCareLeaveUpdateRequest,
): Promise<FamilyCareLeaveResponse | Error> {
  const client = await createClient()

  const response = await client["family-care-leaves"][":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update family care leave")
  }

  return response.json()
}
