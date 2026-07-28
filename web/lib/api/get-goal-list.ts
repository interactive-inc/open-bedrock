import { createClient } from "@/lib/api/hc-client"
import type { GoalSearchQuery } from "@/lib/api/types/goal-types"

/**
 * GET /performance-goals。session トークンで目標一覧を取得する。
 * period / employeeId は絞り込みで、null のキーは送信されない。
 */
export async function getGoalList(query: GoalSearchQuery) {
  const client = await createClient()

  const response = await client["performance-goals"].$get({
    query: {
      period: query.period ?? undefined,
      employee_id: query.employeeId === null ? undefined : String(query.employeeId),
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load goals")
  }

  const body = await response.json()

  return body.data
}
