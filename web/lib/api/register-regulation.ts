import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { RegulationRegisterRequest } from "@/lib/api/types/regulation-types"

// POST /regulations。規程を初版付きで新規登録する（regulation:manage）。
export async function registerRegulation(request: RegulationRegisterRequest) {
  const client = await createClient()

  const response = await client.regulations.$post({ json: request })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "規程の登録に失敗しました",
      conflictMessages: {
        "regulation code already exists": "この規程コードは既に登録されています",
      },
    })
  }

  return response.json()
}
