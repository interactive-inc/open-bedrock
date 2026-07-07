import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ContractCreateRequest } from "@/lib/api/types/contract-types"

// POST /contracts。契約記録を新規作成する（contract:manage）。
export async function createContract(request: ContractCreateRequest) {
  const client = await createClient()

  const response = await client.contracts.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "契約記録の作成に失敗しました",
    })
  }

  return response.json()
}
