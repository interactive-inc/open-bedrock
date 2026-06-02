import { createClient } from "@/lib/api/hc-client"
import type {
  CareerApplication,
  CareerApplicationUpdateRequest,
} from "@/lib/api/types/career-types"

// PUT /career/applications/:id。応募メッセージを変更する。
// 本人以外は 403、選考確定済みは 409 を api が返すため、戻りは Error になる。
export async function updateCareerApplication(
  id: number,
  request: CareerApplicationUpdateRequest,
): Promise<CareerApplication | Error> {
  const client = await createClient()

  const response = await client.career.applications[":id"].$put({
    param: { id: String(id) },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update career application")
  }

  return response.json()
}
