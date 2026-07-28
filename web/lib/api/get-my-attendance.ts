import { createClient } from "@/lib/api/hc-client"
import type { AttendanceSearchQuery } from "@/lib/api/types/attendance-types"

/**
 * GET /attendance-records/me。session cookie のトークンで本人の勤怠一覧を取得する。
 * from / to は期間絞り込みで、null のキーは送信されない。
 * 戻りは AttendanceRecord 配列 or Error。呼び出し元は instanceof Error で判別する。
 */
export async function getMyAttendance(query: AttendanceSearchQuery) {
  const client = await createClient()

  const response = await client["attendance-records"].me.$get({
    query: {
      from: query.from ?? undefined,
      to: query.to ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load attendance")
  }

  const body = await response.json()
  return body.data
}
