import { createClient } from "@/lib/api/hc-client"

/** GET /performance-goals/tree。session トークンで全社→部門→個人の目標ツリーを取得する。 */
export async function getGoalTree(period: string | null) {
  const client = await createClient()

  const response = await client["performance-goals"].tree.$get({
    query: { period: period ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load goal tree")
  }

  const body = await response.json()

  return body.roots
}
