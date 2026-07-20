import { createClient } from "@/lib/api/hc-client"
import type { AntisocialCheckResponse } from "@/lib/api/types/antisocial-check-types"

/** GET /antisocial-checks/me。申請者本人の反社チェック申請一覧を取得する。 */
export async function listMyAntisocialChecks(): Promise<
  ReadonlyArray<AntisocialCheckResponse> | Error
> {
  const client = await createClient()

  const response = await client["antisocial-checks"].me.$get()

  if (response.status >= 400) {
    return new Error("failed to load antisocial checks")
  }

  const body = await response.json()

  return body.data
}
