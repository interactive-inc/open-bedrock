import { createClient } from "@/lib/api/hc-client"
import type { AntisocialCheckAdminResponse } from "@/lib/api/types/antisocial-check-types"

// GET /antisocial-checks/admin。自分を除く判定待ち申請を取得する。
export async function listAntisocialCheckAdmin(): Promise<
  ReadonlyArray<AntisocialCheckAdminResponse> | Error
> {
  const client = await createClient()

  const response = await client["antisocial-checks"].admin.$get({
    query: { status: "requested", limit: "100" },
  })

  if (response.status >= 400) {
    return new Error("failed to load antisocial check inbox")
  }

  const body = await response.json()

  return body.data
}
