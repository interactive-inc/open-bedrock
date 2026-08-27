import { createClient } from "@/lib/api/hc-client"

/**
 * GET /performance-goals?scope=department。指定部署の所属メンバー全員の目標を取得する。
 * goal:read:all、または本人が所属する部署への goal:read:department が無いと api が 403 を返す。
 */
export async function getDepartmentGoals(departmentCode: string) {
  const client = await createClient()

  const response = await client["performance-review"]["performance-goals"].$get({
    query: {
      scope: "department",
      department_code: departmentCode,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load department goals")
  }

  const body = await response.json()

  return body.data
}
