import { createClient } from "@/lib/api/hc-client"
import type { AttendanceSearchQuery } from "@/lib/api/types/attendance-types"

/**
 * GET /attendance。管理者向けの全体勤怠一覧を取得する。
 * employee_id / from / to で絞り込み、null のキーは送信されない。
 * 権限がない場合は api が 403 を返すため、戻りは Error になる。
 */
export async function getAttendanceList(query: AttendanceSearchQuery) {
  const client = await createClient()

  const response = await client.attendance.$get({
    query: {
      employee_id: query.employeeId ?? undefined,
      from: query.from ?? undefined,
      to: query.to ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load attendance list")
  }

  const body = await response.json()
  return body.data
}
