import { createClient } from "@/lib/api/hc-client"
import type {
  AntisocialCheckResponse,
  AntisocialCheckUpdateRequest,
} from "@/lib/api/types/antisocial-check-types"

// PUT /antisocial-checks/:id。反社チェック申請の内容を変更する。本人以外は 403 を api が返すため、戻りは Error になる。
export async function updateAntisocialCheck(
  id: string,
  request: AntisocialCheckUpdateRequest,
): Promise<AntisocialCheckResponse | Error> {
  const client = await createClient()

  const response = await client["antisocial-checks"][":id"].$put({
    param: { id },
    json: request,
  })

  if (response.status >= 400) {
    return new Error("failed to update antisocial check")
  }

  return response.json()
}
