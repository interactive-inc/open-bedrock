import { createClient } from "@/lib/api/hc-client"
import type { AttendanceClockRequest } from "@/lib/api/types/attendance-types"

// POST /attendance/clock-out。session cookie のトークンで退勤打刻する。
// 打刻中でない場合は api が 409 を返すため、戻りは Error になる。
// 戻りは更新された AttendanceRecord or Error。呼び出し元は instanceof Error で判別する。
export async function clockOutAttendance(request: AttendanceClockRequest) {
  const client = await createClient()

  const response = await client.attendance["clock-out"].$post({
    json: { note: request.note ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to clock out")
  }

  return response.json()
}
