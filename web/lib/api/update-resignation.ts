import { createClient } from "@/lib/api/hc-client"
import type {
  ResignationResponse,
  ResignationUpdateRequest,
} from "@/lib/api/types/resignation-types"

// PUT /resignations/:id。退職申請の内容を変更する。本人以外は 403 を api が返すため、戻りは Error になる。
export async function updateResignation(
  id: string,
  request: ResignationUpdateRequest,
): Promise<ResignationResponse | Error> {
  const client = await createClient()

  const response = await client.resignations[":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update resignation")
  }

  return response.json()
}
