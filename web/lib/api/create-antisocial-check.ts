import { createClient } from "@/lib/api/hc-client"
import type { AntisocialCheckCreateRequest } from "@/lib/api/types/antisocial-check-types"

/** POST /antisocial-checks。反社チェック申請を作成する。status は requested で登録される。 */
export async function createAntisocialCheck(request: AntisocialCheckCreateRequest) {
  const client = await createClient()

  const response = await client["antisocial-checks"].$post({ json: request })

  if (response.status >= 400) {
    return new Error("failed to create antisocial check")
  }

  return response.json()
}
