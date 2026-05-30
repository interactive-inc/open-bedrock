import { createClient } from "@/lib/api/hc-client"
import type { AttendanceClockRequest } from "@/lib/api/types/attendance-types"

// POST /attendance/clock-in。session cookie のトークンで出勤打刻する。
// 既に打刻中の場合は api が 409 を返すため、戻りは Error になる。
// 戻りは作成された AttendanceRecord or Error。呼び出し元は instanceof Error で判別する。
export async function clockInAttendance(request: AttendanceClockRequest) {
  const client = await createClient()

  const response = await client.attendance["clock-in"].$post({
    json: { note: request.note ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to clock in")
  }

  return response.json()
}
