import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { AttendanceClockRequest } from "@/lib/api/types/attendance-types"

/**
 * POST /attendance-records/clock-out。session cookie のトークンで退勤打刻する。
 * 打刻中でない場合は api が 409 を返すため、戻りは Error になる。
 * 戻りは更新された AttendanceRecord or Error。呼び出し元は instanceof Error で判別する。
 */
export async function clockOutAttendance(request: AttendanceClockRequest) {
  const client = await createClient()

  const response = await client["attendance"]["attendance-records"]["clock-out"].$post({
    json: { note: request.note ?? undefined },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "退勤打刻に失敗しました",
      conflictMessages: {
        "not clocked in": "出勤打刻がされていません",
        "clock-in time is missing": "出勤打刻の時刻が記録されていません",
        "already clocked out": "既に退勤打刻済みです",
      },
    })
  }

  return response.json()
}
