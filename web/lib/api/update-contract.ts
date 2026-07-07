import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ContractUpdateRequest } from "@/lib/api/types/contract-types"

// PUT /contracts/:id。契約記録の表題・契約日・期間・更新期限・備考を変更する（contract:manage）。
// 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
export async function updateContract(id: number, request: ContractUpdateRequest) {
  const client = await createClient()

  const response = await client.contracts[":id"].$put({ param: { id: String(id) }, json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "契約記録の変更に失敗しました",
    })
  }

  return response.json()
}
