import { createClient } from "@/lib/api/hc-client"
import type { ResignationResponse } from "@/lib/api/types/resignation-types"

// GET /resignations/me。申請者本人の退職申請一覧を取得する。
export async function listMyResignations(): Promise<ReadonlyArray<ResignationResponse> | Error> {
  const client = await createClient()

  const response = await client.resignations.me.$get()

  if (response.status >= 400) {
    return new Error("failed to load resignations")
  }

  return response.json()
}
