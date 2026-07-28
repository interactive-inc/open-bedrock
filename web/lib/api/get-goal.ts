import { createClient } from "@/lib/api/hc-client"

/** GET /performance-goals/:goal_id。1 件の目標詳細を取得する。 */
export async function getGoal(id: number) {
  const client = await createClient()

  const response = await client["performance-goals"][":goal_id"].$get({
    param: { goal_id: String(id) },
  })

  if (response.status >= 400) {
    return new Error("failed to load goal")
  }

  return response.json()
}
