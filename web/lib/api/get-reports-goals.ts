import { createClient } from "@/lib/api/hc-client"

/**
 * GET /performance-goals?scope=reports。配下全員の目標を取得する。
 * goal:read:reports が無いと api が 403 を返すため、戻りは Error になる。
 */
export async function getReportsGoals() {
  const client = await createClient()

  const response = await client["performance-review"]["performance-goals"].$get({
    query: {
      scope: "reports",
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load reports goals")
  }

  const body = await response.json()

  return body.data
}
