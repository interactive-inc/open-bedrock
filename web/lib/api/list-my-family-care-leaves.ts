import { createClient } from "@/lib/api/hc-client"
import type { FamilyCareLeaveResponse } from "@/lib/api/types/family-care-leave-types"

// GET /family-care-leaves/me。申出者本人の休業申出一覧を取得する。
export async function listMyFamilyCareLeaves(): Promise<
  ReadonlyArray<FamilyCareLeaveResponse> | Error
> {
  const client = await createClient()

  const response = await client["family-care-leaves"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load family care leaves")
  }

  const body = await response.json()

  return body.data
}
