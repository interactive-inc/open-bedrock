import { createClient } from "@/lib/api/hc-client"

/**
 * GET /leave-requests?scope=reports。配下全員の休暇申請を取得する。
 * leave:read:reports が無いと api が 403 を返すため、戻りは Error になる。
 */
export async function getReportsLeaveRequests(params: { limit?: number } = {}) {
  const client = await createClient()

  const response = await client["leave"]["leave-requests"].$get({
    query: {
      scope: "reports",
      limit: params.limit !== undefined ? String(params.limit) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load reports leave requests")
  }

  const body = await response.json()

  return body.data
}
