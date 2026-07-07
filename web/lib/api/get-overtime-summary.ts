import { createClient } from "@/lib/api/hc-client"
import type { OvertimeSummaryQuery } from "@/lib/api/types/overtime-types"

// GET /attendance/overtime-summary。時間外の参考集計を取得する。
// scope=reports は attendance:read:reports、scope=all は attendance:read:all を要求する。
// 権限がない場合は api が 403 を返すため、戻りは Error になる。
export async function getOvertimeSummary(query: OvertimeSummaryQuery) {
  const client = await createClient()

  const response = await client.attendance["overtime-summary"].$get({
    query: {
      month: query.month ?? undefined,
      scope: query.scope ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load overtime summary")
  }

  return response.json()
}
