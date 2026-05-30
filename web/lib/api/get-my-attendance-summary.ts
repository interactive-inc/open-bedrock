import { createClient } from "@/lib/api/hc-client"
import type { AttendanceSummaryQuery } from "@/lib/api/types/attendance-types"

// GET /attendance/me/summary。session cookie のトークンで本人の月次サマリを取得する。
// month 未指定（null）は送信されず、api 側で当月が使われる。
// 戻りは AttendanceSummary or Error。呼び出し元は instanceof Error で判別する。
export async function getMyAttendanceSummary(query: AttendanceSummaryQuery) {
  const client = await createClient()

  const response = await client.attendance.me.summary.$get({
    query: {
      month: query.month ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load attendance summary")
  }

  return response.json()
}
