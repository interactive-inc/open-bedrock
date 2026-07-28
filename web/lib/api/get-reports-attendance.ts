import { createClient } from "@/lib/api/hc-client"

/**
 * GET /attendance-records?scope=reports。直属含む配下全員の勤怠を取得する。
 * attendance:read:reports が無いと api が 403 を返すため、戻りは Error になる。
 */
export async function getReportsAttendance(params: { from?: string; to?: string } = {}) {
  const client = await createClient()

  const response = await client["attendance-records"].$get({
    query: {
      scope: "reports",
      from: params.from,
      to: params.to,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load reports attendance")
  }

  const body = await response.json()

  return body.data
}
